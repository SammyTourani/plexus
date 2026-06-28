import type { DependencyEdge, ParamLink, RawToolSchema } from "../types.ts";

// Alias prefix → actual toolkit prefix mapping (verified against real data)
const ALIAS_PREFIX_MAP: Record<string, string> = {
	GMAIL_: "GOOGLESUPER_",
	GOOGLEDRIVE_: "GOOGLESUPER_",
	GOOGLECALENDAR_: "GOOGLESUPER_",
	GOOGLEDOCS_: "GOOGLESUPER_",
	GOOGLESHEETS_: "GOOGLESUPER_",
	GOOGLETASKS_: "GOOGLESUPER_",
	GOOGLE_ANALYTICS_: "GOOGLESUPER_",
};

// Non-tool patterns that look like tool slugs but aren't
const NON_TOOL_PATTERNS = new Set([
	"GITHUB_TOKEN",
	"GITHUB_SHA",
	"GITHUB_WORKFLOW",
	"GITHUB_JOB",
	"GITHUB_",
	"GOOGLEDOCS",
]);

// Regex to extract tool slug references from descriptions
const TOOL_REF_REGEX =
	/(?:GOOGLE_ANALYTICS_[A-Z_]+|GOOGLESUPER_[A-Z_]+|GMAIL_[A-Z_]+|GOOGLEDRIVE_[A-Z_]+|GOOGLECALENDAR_[A-Z_]+|GOOGLEDOCS_[A-Z_]+|GOOGLESHEETS_[A-Z_]+|GOOGLETASKS_[A-Z_]+|GITHUB_[A-Z_]+)/g;

function resolveAlias(slug: string): string {
	for (const [alias, real] of Object.entries(ALIAS_PREFIX_MAP)) {
		if (slug.startsWith(alias)) {
			return real + slug.slice(alias.length);
		}
	}
	return slug; // Already a real slug (GOOGLESUPER_ or GITHUB_)
}

export function extractDescriptionDeps(
	rawTools: RawToolSchema[],
): DependencyEdge[] {
	const slugSet = new Set(rawTools.map((t) => t.slug));
	const edgeMap = new Map<string, DependencyEdge>(); // "from→to" key

	for (const tool of rawTools) {
		const props = tool.inputParameters?.properties ?? {};

		for (const [paramName, prop] of Object.entries(props)) {
			const desc = prop.description ?? "";
			const matches = desc.match(TOOL_REF_REGEX);
			if (!matches) continue;

			for (const rawRef of matches) {
				// Skip non-tool patterns
				if (NON_TOOL_PATTERNS.has(rawRef)) continue;

				// Skip self-references
				if (rawRef === tool.slug) continue;

				// Resolve alias to actual slug
				const resolvedSlug = resolveAlias(rawRef);

				// Skip if resolved slug doesn't exist in our dataset
				if (!slugSet.has(resolvedSlug)) continue;

				// Skip self-reference after resolution
				if (resolvedSlug === tool.slug) continue;

				const edgeKey = `${resolvedSlug}→${tool.slug}`;
				const link: ParamLink = {
					inputParam: paramName,
					producerSlug: resolvedSlug,
					reason: `Description references ${rawRef}`,
					matchType: "description",
					evidence: "explicit",
				};

				if (edgeMap.has(edgeKey)) {
					edgeMap.get(edgeKey)?.params.push(link);
				} else {
					edgeMap.set(edgeKey, {
						from: resolvedSlug,
						to: tool.slug,
						params: [link],
						confidence: 0.95,
					});
				}
			}
		}
	}

	const edges = [...edgeMap.values()];
	console.log(`  Description matcher: ${edges.length} edges found`);
	return edges;
}
