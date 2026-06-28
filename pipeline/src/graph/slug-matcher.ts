import type { DependencyEdge, ParamLink, RawToolSchema } from "../types.ts";

// Generic param names that produce too many false positives — skip these entirely
const GENERIC_PARAMS = new Set([
	"id",
	"name",
	"type",
	"data",
	"query",
	"description",
	"title",
	"value",
	"key",
	"url",
	"text",
	"content",
	"format",
	"mode",
	"status",
	"action",
	"method",
	"fields",
	"filter",
	"sort",
	"order",
	"page",
	"limit",
	"offset",
	"token",
	"cursor",
	"body",
	"path",
	"email",
	"emails",
	"permission",
	"permissions",
	"role",
	"scope",
	"labels",
	"state",
	"per_page",
	"since",
	"until",
	"direction",
	"ref",
	"sha",
	"tag",
	"branch",
	"message",
	"owner",
	"repo",
	"org",
	"username",
	"assignees",
	"input",
	"property",
	"parent",
	// High-cardinality entities that are too ubiquitous to be useful
	"repository",
	"file",
	"spreadsheet",
	"document",
	"organization",
	"project",
	"comment",
	"reaction",
	"gist",
	"calendar",
]);

// Max number of producer candidates per (consumer, param) pair
const MAX_PRODUCERS_PER_PARAM = 3;

// Slug patterns that are weak producers — these tools are not natural "data sources"
// for the entity IDs they happen to reference
const WEAK_PRODUCER_PATTERNS = [
	/CREATE_.*_TYPE$/, // e.g., CREATE_ISSUE_TYPE — creates metadata, not the entity itself
	/_DEPENDENCIES_/, // e.g., LIST_ISSUE_DEPENDENCIES_BLOCKED_BY — relationship queries
	/_PROTECTION$/, // e.g., GET_PULL_REQUEST_REVIEW_PROTECTION — config, not data
	/_RESTRICTIONS/, // e.g., ADD_ACCESS_RESTRICTIONS — config
	/^ADD_.*_TO_/, // e.g., ADD_LABELS_TO_AN_ISSUE — mutator, not producer
	/^REMOVE_.*_FROM_/, // e.g., REMOVE_LABELS_FROM_AN_ISSUE — mutator
	/^SET_/, // e.g., SET_DEFAULT_WORKFLOW_PERMISSIONS — config
	/^ENABLE_|^DISABLE_/, // toggle tools
	/^APPROVE_|^DISMISS_/, // review actions
	/^LOCK_|^UNLOCK_/, // state toggles
];

// Only match params that end with these suffixes — strong signal of entity reference
const ENTITY_REF_SUFFIXES = [
	/_id$/,
	/_ids$/,
	/Id$/,
	/Ids$/,
	/_number$/,
	/Number$/,
];

// Producer verb patterns in slugs and their confidence scores
const PRODUCER_VERBS: Array<{ pattern: RegExp; score: number }> = [
	{ pattern: /^LIST_/, score: 0.8 },
	{ pattern: /^SEARCH_/, score: 0.78 },
	{ pattern: /^FETCH_/, score: 0.78 },
	{ pattern: /^FIND_/, score: 0.75 },
	{ pattern: /^GET_/, score: 0.7 },
	{ pattern: /^CREATE_/, score: 0.6 },
];

function extractEntity(paramName: string): string | null {
	// Only match params that look like entity references
	const isEntityRef = ENTITY_REF_SUFFIXES.some((r) => r.test(paramName));
	if (!isEntityRef) return null;

	// Normalize: camelCase → snake_case
	const snaked = paramName.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();

	// Strip the suffix to get the entity
	const stripped = snaked.replace(/_ids?$/, "").replace(/_number$/, "");

	// Skip generics
	if (GENERIC_PARAMS.has(stripped)) return null;
	if (stripped.length < 3) return null;

	return stripped;
}

function getToolkitPrefix(slug: string): string {
	if (slug.startsWith("GOOGLESUPER_")) return "GOOGLESUPER";
	if (slug.startsWith("GITHUB_")) return "GITHUB";
	return slug.split("_")[0] ?? "";
}

function getActionPart(slug: string): string {
	const prefix = `${getToolkitPrefix(slug)}_`;
	return slug.slice(prefix.length);
}

export function extractSlugDeps(
	rawTools: RawToolSchema[],
	existingEdgeKeys: Set<string>,
): DependencyEdge[] {
	// Index tools by toolkit
	const toolsByToolkit = new Map<string, RawToolSchema[]>();
	for (const tool of rawTools) {
		const prefix = getToolkitPrefix(tool.slug);
		if (!toolsByToolkit.has(prefix)) toolsByToolkit.set(prefix, []);
		toolsByToolkit.get(prefix)?.push(tool);
	}

	const edgeMap = new Map<string, DependencyEdge>();

	for (const tool of rawTools) {
		const props = tool.inputParameters?.properties ?? {};
		const requiredSet = new Set(tool.inputParameters?.required ?? []);
		const toolkitPrefix = getToolkitPrefix(tool.slug);
		const sameToolkitTools = toolsByToolkit.get(toolkitPrefix) ?? [];

		for (const [paramName] of Object.entries(props)) {
			if (!requiredSet.has(paramName)) continue;

			const entity = extractEntity(paramName);
			if (!entity) continue;

			// Build entity variants for matching: "thread" → ["thread", "threads"]
			const entityNorm = entity.replace(/_/g, "");
			const entityPlural = `${entityNorm}s`;
			let matchCount = 0;

			for (const candidate of sameToolkitTools) {
				if (matchCount >= MAX_PRODUCERS_PER_PARAM) break;
				if (candidate.slug === tool.slug) continue;

				const actionPart = getActionPart(candidate.slug);

				// Skip weak producer patterns (noisy tools that aren't natural data sources)
				if (WEAK_PRODUCER_PATTERNS.some((wp) => wp.test(actionPart))) continue;

				for (const { pattern, score } of PRODUCER_VERBS) {
					if (!pattern.test(actionPart)) continue;

					const verbMatch = actionPart.match(pattern);
					if (!verbMatch) continue;

					// What comes after the verb, split into words
					const restWords = actionPart
						.slice(verbMatch[0].length)
						.toLowerCase()
						.split("_")
						.filter(Boolean);

					// The entity (or its plural) must be the FIRST significant word after the verb
					// This prevents "LIST_ISSUES_FOR_A_REPOSITORY" from matching entity "repository"
					// but allows it to match entity "issue"
					const firstWord = restWords[0] ?? "";
					const match =
						firstWord === entityNorm ||
						firstWord === entityPlural ||
						entityNorm === firstWord ||
						entityPlural === firstWord;

					if (!match) continue;

					const edgeKey = `${candidate.slug}→${tool.slug}`;
					if (existingEdgeKeys.has(edgeKey)) continue;

					const link: ParamLink = {
						inputParam: paramName,
						producerSlug: candidate.slug,
						reason: `${paramName} → ${candidate.slug}`,
						matchType: "heuristic",
						evidence: "inferred",
					};

					if (edgeMap.has(edgeKey)) {
						edgeMap.get(edgeKey)?.params.push(link);
					} else {
						edgeMap.set(edgeKey, {
							from: candidate.slug,
							to: tool.slug,
							params: [link],
							confidence: score,
						});
					}
					matchCount++;
					break;
				}
			}
		}
	}

	const edges = [...edgeMap.values()];
	console.log(`  Slug matcher: ${edges.length} edges found`);
	return edges;
}
