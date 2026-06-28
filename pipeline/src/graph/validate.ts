import type { DependencyGraph } from "../types.ts";

interface ValidationResult {
	passed: boolean;
	mustHaveResults: Array<{ edge: string; found: boolean }>;
	mustNotHaveResults: Array<{ rule: string; violations: string[] }>;
	summary: string;
}

// Golden set: edges that MUST exist (verified through description parsing + API workflow analysis)
const MUST_HAVE_EDGES: Array<[string, string, string]> = [
	// Gmail thread workflow: list threads → reply to thread
	["GOOGLESUPER_LIST_THREADS", "GOOGLESUPER_REPLY_TO_THREAD", "thread_id"],
	[
		"GOOGLESUPER_LIST_THREADS",
		"GOOGLESUPER_FETCH_MESSAGE_BY_THREAD_ID",
		"thread_id",
	],
	// Gmail email workflow: contact lookup → send email
	["GOOGLESUPER_SEARCH_PEOPLE", "GOOGLESUPER_SEND_EMAIL", "recipient_email"],
	["GOOGLESUPER_GET_CONTACTS", "GOOGLESUPER_SEND_EMAIL", "recipient_email"],
	// Verified description-based edges
	[
		"GITHUB_LIST_ARTIFACTS_FOR_A_REPOSITORY",
		"GITHUB_DOWNLOAD_AN_ARTIFACT",
		"artifact_id",
	],
	["GOOGLESUPER_LIST_DRAFTS", "GOOGLESUPER_DELETE_DRAFT", "draft_id"],
	["GOOGLESUPER_FIND_FILE", "GOOGLESUPER_EDIT_FILE", "file_id"],
	// Additional high-value chains
	[
		"GOOGLESUPER_LIST_LABELS",
		"GOOGLESUPER_BATCH_MODIFY_MESSAGES",
		"addLabelIds",
	],
	["GOOGLESUPER_FETCH_EMAILS", "GOOGLESUPER_ADD_LABEL_TO_EMAIL", "message_id"],
	["GOOGLESUPER_LIST_CALENDARS", "GOOGLESUPER_CREATE_EVENT", "calendar_id"],
];

export function validateGraph(graph: DependencyGraph): ValidationResult {
	const edgeSet = new Set(graph.edges.map((e) => `${e.from}→${e.to}`));
	const edgeParamSet = new Set(
		graph.edges.flatMap((e) =>
			e.params.map((p) => `${e.from}→${e.to}:${p.inputParam}`),
		),
	);

	// Check must-have edges — require BOTH edge AND correct param
	const mustHaveResults = MUST_HAVE_EDGES.map(([from, to, param]) => {
		const edgeExists = edgeSet.has(`${from}→${to}`);
		const paramExists = edgeParamSet.has(`${from}→${to}:${param}`);
		return {
			edge: `${from} → ${to} [${param}]`,
			found: edgeExists && paramExists,
			edgeOnly: edgeExists && !paramExists,
		};
	});

	// Check must-not-have rules
	const mustNotHaveResults: Array<{ rule: string; violations: string[] }> = [];

	// Rule 1: No self-references
	const selfRefs = graph.edges.filter((e) => e.from === e.to);
	mustNotHaveResults.push({
		rule: "No self-reference edges",
		violations: selfRefs.map((e) => e.from),
	});

	// Rule 2: No HEURISTIC edges from generic-only params (owner, repo, name, id alone)
	// Description-based edges are exempt — they have explicit human-authored justification
	const genericOnlyParams = new Set([
		"owner",
		"repo",
		"name",
		"id",
		"org",
		"username",
	]);
	const genericOnlyEdges = graph.edges.filter(
		(e) =>
			e.params.every((p) => genericOnlyParams.has(p.inputParam)) &&
			e.params.every((p) => p.matchType === "heuristic"),
	);
	mustNotHaveResults.push({
		rule: "No heuristic edges based solely on generic params (owner/repo/name/id)",
		violations: genericOnlyEdges.map(
			(e) =>
				`${e.from}→${e.to} [${e.params.map((p) => p.inputParam).join(",")}]`,
		),
	});

	// Rule 3: No cross-toolkit edges (GOOGLESUPER ↔ GITHUB)
	const crossToolkit = graph.edges.filter((e) => {
		const fromGS = e.from.startsWith("GOOGLESUPER_");
		const toGS = e.to.startsWith("GOOGLESUPER_");
		return fromGS !== toGS;
	});
	mustNotHaveResults.push({
		rule: "No cross-toolkit edges (Google Super ↔ GitHub)",
		violations: crossToolkit.map((e) => `${e.from}→${e.to}`),
	});

	// Rule 4: Destructive/readOnly tag consistency
	// Tools tagged readOnlyHint should not appear as consumers of destructive tools
	// Tools tagged destructiveHint should generally be terminal (few outgoing deps)
	const nodeMap = new Map(graph.nodes.map((n) => [n.slug, n]));
	const outDegree = new Map<string, number>();
	for (const e of graph.edges) {
		outDegree.set(e.from, (outDegree.get(e.from) ?? 0) + 1);
	}
	const suspiciousProducers = graph.edges
		.filter((e) => {
			const fromNode = nodeMap.get(e.from);
			return (
				fromNode?.tags.includes("destructiveHint") &&
				(outDegree.get(e.from) ?? 0) > 5
			);
		})
		.map((e) => e.from);
	const uniqueSuspicious = [...new Set(suspiciousProducers)];
	mustNotHaveResults.push({
		rule: "No destructive tools acting as high-degree producers (>5 outgoing edges)",
		violations: uniqueSuspicious,
	});

	const allMustHavePassed = mustHaveResults.every((r) => r.found);
	const allMustNotPassed = mustNotHaveResults.every(
		(r) => r.violations.length === 0,
	);
	const passed = allMustHavePassed && allMustNotPassed;

	const lines: string[] = ["Validation Results:", ""];

	lines.push("MUST-HAVE EDGES:");
	for (const r of mustHaveResults) {
		const status = r.found
			? "PASS"
			: r.edgeOnly
				? "PARTIAL (edge exists, wrong param)"
				: "FAIL";
		lines.push(`  ${status} ${r.edge}`);
	}

	lines.push("");
	lines.push("MUST-NOT-HAVE RULES:");
	for (const r of mustNotHaveResults) {
		const status = r.violations.length === 0 ? "PASS" : "FAIL";
		lines.push(`  ${status} ${r.rule} (${r.violations.length} violations)`);
		for (const v of r.violations.slice(0, 3)) {
			lines.push(`    - ${v}`);
		}
		if (r.violations.length > 3) {
			lines.push(`    ... and ${r.violations.length - 3} more`);
		}
	}

	lines.push("");
	lines.push(passed ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED");

	return {
		passed,
		mustHaveResults,
		mustNotHaveResults,
		summary: lines.join("\n"),
	};
}
