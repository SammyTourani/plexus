import { access, readFile, writeFile } from "node:fs/promises";
import type { DependencyGraph } from "../types.ts";

const BASE = "https://backend.composio.dev";
const CACHE_PATH = "output/cross-reference.json";

// Map old-format slugs returned by SEARCH_TOOLS to GOOGLESUPER_ format
const ALIAS_PREFIX_MAP: Record<string, string> = {
	GMAIL_: "GOOGLESUPER_",
	GOOGLEDRIVE_: "GOOGLESUPER_",
	GOOGLECALENDAR_: "GOOGLESUPER_",
	GOOGLEDOCS_: "GOOGLESUPER_",
	GOOGLESHEETS_: "GOOGLESUPER_",
	GOOGLETASKS_: "GOOGLESUPER_",
	GOOGLE_ANALYTICS_: "GOOGLESUPER_",
};

function resolveSlug(slug: string): string {
	for (const [alias, real] of Object.entries(ALIAS_PREFIX_MAP)) {
		if (slug.startsWith(alias)) return real + slug.slice(alias.length);
	}
	return slug;
}

interface CrossRefResult {
	toolSlug: string;
	query: string;
	composioSuggests: string[];
	ourGraphHas: string[];
	agreement: string[];
	onlyComposio: string[];
	onlyOurGraph: string[];
}

export interface CrossReferenceReport {
	results: CrossRefResult[];
	summary: {
		totalToolsChecked: number;
		averageAgreementRate: number;
		totalAgreements: number;
		totalOnlyComposio: number;
		totalOnlyOurGraph: number;
	};
	timestamp: string;
}

/**
 * Pick a representative sample of consumer tools to cross-reference.
 * We want tools that:
 * - Have edges in our graph (so we can compare)
 * - Cover different services (Gmail, Calendar, Drive, Sheets, GitHub)
 * - Include both assignment examples
 */
function pickSampleTools(
	_graph: DependencyGraph,
): Array<{ slug: string; query: string }> {
	return [
		// Assignment example #1
		{
			slug: "GOOGLESUPER_REPLY_TO_THREAD",
			query: "tools needed before replying to a Gmail thread (need thread_id)",
		},
		// Assignment example #2
		{
			slug: "GOOGLESUPER_SEND_EMAIL",
			query:
				"tools needed before sending an email in Gmail (need recipient email address)",
		},
		// Gmail
		{
			slug: "GOOGLESUPER_DELETE_DRAFT",
			query: "tools needed before deleting a Gmail draft (need draft_id)",
		},
		{
			slug: "GOOGLESUPER_ADD_LABEL_TO_EMAIL",
			query:
				"tools needed before adding a label to a Gmail message (need message_id)",
		},
		// Calendar
		{
			slug: "GOOGLESUPER_CREATE_EVENT",
			query:
				"tools needed before creating a Google Calendar event (need calendar_id)",
		},
		{
			slug: "GOOGLESUPER_PATCH_EVENT",
			query:
				"tools needed before updating a Google Calendar event (need event_id, calendar_id)",
		},
		// Drive
		{
			slug: "GOOGLESUPER_EDIT_FILE",
			query: "tools needed before editing a Google Drive file (need file_id)",
		},
		// Sheets
		{
			slug: "GOOGLESUPER_ADD_SHEET",
			query:
				"tools needed before adding a sheet to a Google Spreadsheet (need spreadsheetId)",
		},
		// Docs
		{
			slug: "GOOGLESUPER_GET_DOCUMENT_BY_ID",
			query:
				"tools needed before getting a Google Doc by ID (need document id)",
		},
		// Tasks
		{
			slug: "GOOGLESUPER_DELETE_TASK",
			query:
				"tools needed before deleting a Google Task (need task_id, tasklist_id)",
		},
		// GitHub
		{
			slug: "GITHUB_DOWNLOAD_AN_ARTIFACT",
			query:
				"tools needed before downloading a GitHub Actions artifact (need artifact_id)",
		},
		{
			slug: "GITHUB_CREATE_AN_ISSUE_COMMENT",
			query:
				"tools needed before creating a comment on a GitHub issue (need issue_number)",
		},
		{
			slug: "GITHUB_CREATE_A_REVIEW_FOR_A_PULL_REQUEST",
			query:
				"tools needed before creating a review on a GitHub pull request (need pull_number)",
		},
		{
			slug: "GITHUB_MERGE_A_PULL_REQUEST",
			query:
				"tools needed before merging a GitHub pull request (need pull_number)",
		},
		{
			slug: "GITHUB_CREATE_A_RELEASE",
			query:
				"tools needed before creating a GitHub release (need repo, tag_name)",
		},
	];
}

async function createSession(apiKey: string): Promise<string> {
	const resp = await fetch(`${BASE}/api/v3/tool_router/session`, {
		method: "POST",
		headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
		body: JSON.stringify({
			toolkit_slugs: ["composio"],
			user_id: "dep-graph-crossref",
		}),
	});
	const session = (await resp.json()) as { session_id: string };
	return session.session_id;
}

async function searchTools(
	sessionId: string,
	apiKey: string,
	queries: Array<{ use_case: string }>,
): Promise<
	Array<{
		use_case: string;
		primary_tool_slugs: string[];
		related_tool_slugs: string[];
	}>
> {
	const resp = await fetch(
		`${BASE}/api/v3/tool_router/session/${sessionId}/search`,
		{
			method: "POST",
			headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
			body: JSON.stringify({ queries }),
		},
	);
	const data = (await resp.json()) as {
		results?: Array<{
			use_case: string;
			primary_tool_slugs: string[];
			related_tool_slugs: string[];
		}>;
	};
	return data.results ?? [];
}

export async function runCrossReference(
	graph: DependencyGraph,
): Promise<CrossReferenceReport> {
	// Check cache first
	try {
		await access(CACHE_PATH);
		console.log("  Using cached cross-reference from", CACHE_PATH);
		return JSON.parse(await readFile(CACHE_PATH, "utf-8"));
	} catch {
		// Not cached
	}

	const apiKey = process.env.COMPOSIO_API_KEY;
	if (!apiKey) throw new Error("COMPOSIO_API_KEY required for cross-reference");

	console.log("  Creating tool router session...");
	const sessionId = await createSession(apiKey);

	// Build the set of our graph's edges for each consumer
	const ourEdgesByConsumer = new Map<string, Set<string>>();
	for (const edge of graph.edges) {
		if (!ourEdgesByConsumer.has(edge.to))
			ourEdgesByConsumer.set(edge.to, new Set());
		ourEdgesByConsumer.get(edge.to)?.add(edge.from);
	}

	const allSlugs = new Set(graph.nodes.map((n) => n.slug));
	const samples = pickSampleTools(graph);

	// Batch queries in groups of 5 to be respectful of rate limits
	const results: CrossRefResult[] = [];
	const BATCH_SIZE = 5;

	for (let i = 0; i < samples.length; i += BATCH_SIZE) {
		const batch = samples.slice(i, i + BATCH_SIZE);
		process.stdout.write(
			`  Querying Composio SEARCH_TOOLS [${i + 1}-${Math.min(i + BATCH_SIZE, samples.length)}/${samples.length}]... `,
		);

		try {
			const searchResults = await searchTools(
				sessionId,
				apiKey,
				batch.map((s) => ({ use_case: s.query })),
			);

			for (let j = 0; j < batch.length; j++) {
				const sample = batch[j];
				if (!sample) continue;
				const searchResult = searchResults[j];
				if (!searchResult) continue;

				// Composio suggests these tools as related/prerequisite
				const composioRaw = [
					...(searchResult.primary_tool_slugs ?? []),
					...(searchResult.related_tool_slugs ?? []),
				];

				// Resolve to our slug format and filter to tools in our dataset
				// Also filter out the tool itself
				const composioSuggests = [
					...new Set(
						composioRaw
							.map(resolveSlug)
							.filter((s) => allSlugs.has(s) && s !== sample.slug),
					),
				];

				// What our graph says are producers for this tool
				const ourProducers = [...(ourEdgesByConsumer.get(sample.slug) ?? [])];

				// Compute agreement
				const composioSet = new Set(composioSuggests);
				const ourSet = new Set(ourProducers);
				const agreement = composioSuggests.filter((s) => ourSet.has(s));
				const onlyComposio = composioSuggests.filter((s) => !ourSet.has(s));
				const onlyOurGraph = ourProducers.filter((s) => !composioSet.has(s));

				results.push({
					toolSlug: sample.slug,
					query: sample.query,
					composioSuggests,
					ourGraphHas: ourProducers,
					agreement,
					onlyComposio,
					onlyOurGraph,
				});
			}
			console.log("done");
		} catch (err) {
			console.log(`error: ${err instanceof Error ? err.message : err}`);
		}
	}

	// Compute summary
	let totalAgreements = 0;
	let totalOnlyComposio = 0;
	let totalOnlyOurGraph = 0;
	let totalComparisons = 0;

	for (const r of results) {
		totalAgreements += r.agreement.length;
		totalOnlyComposio += r.onlyComposio.length;
		totalOnlyOurGraph += r.onlyOurGraph.length;
		// Agreement rate: how many of Composio's suggestions we also have
		if (r.composioSuggests.length > 0) {
			totalComparisons++;
		}
	}

	const avgAgreement =
		totalComparisons > 0
			? results.reduce((sum, r) => {
					if (r.composioSuggests.length === 0) return sum;
					return sum + r.agreement.length / r.composioSuggests.length;
				}, 0) / totalComparisons
			: 0;

	const report: CrossReferenceReport = {
		results,
		summary: {
			totalToolsChecked: results.length,
			averageAgreementRate: Math.round(avgAgreement * 100) / 100,
			totalAgreements,
			totalOnlyComposio,
			totalOnlyOurGraph,
		},
		timestamp: new Date().toISOString(),
	};

	// Cache
	await writeFile(CACHE_PATH, JSON.stringify(report, null, 2), "utf-8");

	return report;
}

export function printCrossReferenceReport(report: CrossReferenceReport): void {
	console.log("\nCross-Reference Results:");
	console.log(
		`  Checked ${report.summary.totalToolsChecked} tools against Composio SEARCH_TOOLS`,
	);
	console.log(
		`  Agreement rate: ${(report.summary.averageAgreementRate * 100).toFixed(0)}% of Composio's suggestions match our graph`,
	);
	console.log(`  Agreements: ${report.summary.totalAgreements}`);
	console.log(`  Only in Composio: ${report.summary.totalOnlyComposio}`);
	console.log(`  Only in our graph: ${report.summary.totalOnlyOurGraph}`);

	console.log("\n  Per-tool breakdown:");
	for (const r of report.results) {
		const rate =
			r.composioSuggests.length > 0
				? `${Math.round((r.agreement.length / r.composioSuggests.length) * 100)}%`
				: "N/A";
		console.log(`    ${r.toolSlug}: ${rate} agreement`);
		if (r.agreement.length > 0)
			console.log(`      Agree: ${r.agreement.join(", ")}`);
		if (r.onlyComposio.length > 0)
			console.log(`      Only Composio: ${r.onlyComposio.join(", ")}`);
		if (r.onlyOurGraph.length > 0)
			console.log(`      Only ours: ${r.onlyOurGraph.join(", ")}`);
	}
}
