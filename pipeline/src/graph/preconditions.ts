import type { DependencyGraph, ToolNode } from "../types.ts";

type Resolution = "tool" | "user" | "tool_or_user" | "unknown";

interface InputResolution {
	name: string;
	type: string;
	required: boolean;
	resolution: Resolution;
	reason: string;
	candidateTools: string[];
}

interface ConditionalGroup {
	condition: string;
	params: InputResolution[];
}

interface ToolPreconditions {
	tool: string;
	name: string;
	toolkit: string;
	requiredInputs: InputResolution[];
	conditionalInputs?: ConditionalGroup[];
}

// Params that are almost always provided by the user or calling agent directly
const USER_PROVIDED_PARAMS = new Set([
	// Content / freeform
	"subject",
	"body",
	"content",
	"text",
	"message",
	"description",
	"title",
	"name",
	"markdown_text",
	"html_content",
	"plain_text",
	// Config / preferences
	"is_html",
	"format",
	"language",
	"timezone",
	"color",
	"visibility",
	"send_notifications",
	// Booleans / toggles
	"hidden",
	"selected",
	"include_payload",
	"case_sensitive",
	"has_header_row",
	"force_unique",
	"show_deleted",
	// Quantities / ranges
	"max_results",
	"batch_size",
	"length",
	"start_index",
	"end_index",
	// Search / filter
	"query",
	"q",
	"search",
	"filter",
]);

// Params that are typically entity references resolvable by other tools
const TOOL_RESOLVABLE_SUFFIXES = [
	/_id$/,
	/_ids$/,
	/Id$/,
	/Ids$/,
	/_number$/,
	/Number$/,
];

// Params that could come from either a tool or the user
const DUAL_SOURCE_PARAMS = new Set([
	"email",
	"emails",
	"recipient_email",
	"to",
	"cc",
	"bcc",
	"from_email",
	"extra_recipients",
	"email_address",
	// Identifiers the user might know directly
	"owner",
	"repo",
	"org",
	"username",
	"branch",
	"tag",
	"ref",
	"path",
	"url",
]);

function classifyParam(
	paramName: string,
	paramType: string,
	description: string,
	producerTools: string[],
): { resolution: Resolution; reason: string } {
	// If other tools produce this value, it's at least tool-resolvable
	const hasProducers = producerTools.length > 0;

	// Check explicit user-provided params
	if (USER_PROVIDED_PARAMS.has(paramName)) {
		return {
			resolution: "user",
			reason:
				"Freeform content or preference — provided by the user or calling agent",
		};
	}

	// Check dual-source params
	if (DUAL_SOURCE_PARAMS.has(paramName)) {
		if (hasProducers) {
			return {
				resolution: "tool_or_user",
				reason: `User may provide directly, or resolve via: ${producerTools.slice(0, 3).join(", ")}`,
			};
		}
		return {
			resolution: "user",
			reason: "Typically provided directly by the user",
		};
	}

	// Check entity reference suffixes
	const isEntityRef = TOOL_RESOLVABLE_SUFFIXES.some((r) => r.test(paramName));
	if (isEntityRef) {
		if (hasProducers) {
			return {
				resolution: "tool",
				reason: `Obtain from: ${producerTools.slice(0, 3).join(", ")}`,
			};
		}
		return {
			resolution: "unknown",
			reason:
				"Looks like an entity reference but no known producer tool was found",
		};
	}

	// Check if description mentions getting value from another tool
	if (
		description.match(
			/use\s|call\s|retrieve.*from|obtain.*from|get.*from|GOOGLE|GMAIL|GITHUB/i,
		)
	) {
		if (hasProducers) {
			return {
				resolution: "tool",
				reason: `Description references producer tools: ${producerTools.slice(0, 3).join(", ")}`,
			};
		}
		return {
			resolution: "tool_or_user",
			reason:
				"Description suggests tool resolution but no specific producer found",
		};
	}

	// If we have producer tools from the graph, it's tool-resolvable
	if (hasProducers) {
		return {
			resolution: "tool",
			reason: `Resolved by: ${producerTools.slice(0, 3).join(", ")}`,
		};
	}

	// Arrays and objects are usually user-constructed
	if (paramType === "array" || paramType === "object") {
		return {
			resolution: "user",
			reason:
				"Structured input typically composed by the user or calling agent",
		};
	}

	// Default: unknown
	return {
		resolution: "unknown",
		reason: "Could not determine resolution source",
	};
}

/**
 * Detect conditional requirements from parameter descriptions.
 * Many tools have no schema-level `required[]` but their descriptions say things like:
 * - "At least one of 'to'/'recipient_email', 'cc', or 'bcc' must be provided"
 * - "Either subject or body must be provided"
 */
function detectConditionalGroups(
	node: ToolNode,
	producerMap: Map<string, string[]>,
): ConditionalGroup[] {
	const groups: ConditionalGroup[] = [];
	const seenConditions = new Set<string>();

	for (const input of node.inputs) {
		const desc = input.description;

		// Pattern: "at least one of X, Y, or Z must be provided"
		const atLeastOneMatch = desc.match(
			/[Aa]t least one of\s+(.+?)\s+must be provided/,
		);
		if (atLeastOneMatch?.[1]) {
			const matchedText = atLeastOneMatch[1];
			const condition = `At least one required: ${matchedText}`;
			if (seenConditions.has(condition)) continue;
			seenConditions.add(condition);

			// Extract param names from the condition text
			const paramNames = matchedText
				.replace(/['''"]/g, "")
				.split(/,\s*(?:or\s+)?|\s+or\s+|\s*\/\s*/)
				.map((s) => s.trim())
				.filter(Boolean);

			const params = paramNames
				.map((name) => {
					const found = node.inputs.find((i) => i.name === name);
					if (!found) return null;
					const producers = producerMap.get(name) ?? [];
					const { resolution, reason } = classifyParam(
						name,
						found.type,
						found.description,
						producers,
					);
					return {
						name,
						type: found.type,
						required: false,
						resolution,
						reason,
						candidateTools: producers,
					};
				})
				.filter((p): p is InputResolution => p !== null);

			if (params.length > 0) {
				groups.push({ condition, params });
			}
		}

		// Pattern: "Either X or Y must be provided"
		const eitherMatch = desc.match(
			/[Ee]ither\s+(\w+)\s+or\s+(\w+)\s+must be provided/,
		);
		if (eitherMatch?.[1] && eitherMatch[2]) {
			const param1 = eitherMatch[1];
			const param2 = eitherMatch[2];
			const condition = `Either ${param1} or ${param2} required`;
			if (seenConditions.has(condition)) continue;
			seenConditions.add(condition);

			const paramNames = [param1, param2];
			const params = paramNames
				.map((name) => {
					const found = node.inputs.find((i) => i.name === name);
					if (!found) return null;
					const producers = producerMap.get(name) ?? [];
					const { resolution, reason } = classifyParam(
						name,
						found.type,
						found.description,
						producers,
					);
					return {
						name,
						type: found.type,
						required: false,
						resolution,
						reason,
						candidateTools: producers,
					};
				})
				.filter((p): p is InputResolution => p !== null);

			if (params.length > 0) {
				groups.push({ condition, params });
			}
		}
	}

	return groups;
}

export function buildPreconditions(
	graph: DependencyGraph,
): ToolPreconditions[] {
	// Build a map: consumer tool → param → [producer tools]
	const producersByConsumerParam = new Map<string, Map<string, string[]>>();
	for (const edge of graph.edges) {
		if (!producersByConsumerParam.has(edge.to)) {
			producersByConsumerParam.set(edge.to, new Map());
		}
		const paramMap = producersByConsumerParam.get(edge.to)!;
		for (const p of edge.params) {
			if (!paramMap.has(p.inputParam)) {
				paramMap.set(p.inputParam, []);
			}
			paramMap.get(p.inputParam)?.push(edge.from);
		}
	}

	const results: ToolPreconditions[] = [];

	for (const node of graph.nodes) {
		const requiredInputs = node.inputs.filter((i) => i.required);
		const paramProducers = producersByConsumerParam.get(node.slug) ?? new Map();

		const inputResolutions: InputResolution[] = requiredInputs.map((input) => {
			const producers = paramProducers.get(input.name) ?? [];
			const { resolution, reason } = classifyParam(
				input.name,
				input.type,
				input.description,
				producers,
			);
			return {
				name: input.name,
				type: input.type,
				required: true,
				resolution,
				reason,
				candidateTools: producers,
			};
		});

		// Detect conditional requirements from descriptions
		const conditionalGroups = detectConditionalGroups(node, paramProducers);

		// Include this tool if it has required inputs OR conditional groups OR graph edges
		const hasGraphEdges = producersByConsumerParam.has(node.slug);
		if (
			requiredInputs.length === 0 &&
			conditionalGroups.length === 0 &&
			!hasGraphEdges
		)
			continue;

		const entry: ToolPreconditions = {
			tool: node.slug,
			name: node.name,
			toolkit: node.toolkit,
			requiredInputs: inputResolutions,
		};

		if (conditionalGroups.length > 0) {
			entry.conditionalInputs = conditionalGroups;
		}

		results.push(entry);
	}

	// Sort by toolkit then slug for readability
	results.sort((a, b) => a.tool.localeCompare(b.tool));

	return results;
}

export function summarizePreconditions(
	preconditions: ToolPreconditions[],
): string {
	let toolCount = 0;
	let userCount = 0;
	let toolOrUserCount = 0;
	let unknownCount = 0;

	for (const p of preconditions) {
		for (const input of p.requiredInputs) {
			switch (input.resolution) {
				case "tool":
					toolCount++;
					break;
				case "user":
					userCount++;
					break;
				case "tool_or_user":
					toolOrUserCount++;
					break;
				case "unknown":
					unknownCount++;
					break;
			}
		}
	}

	const total = toolCount + userCount + toolOrUserCount + unknownCount;

	return [
		`Precondition Analysis:`,
		`  Tools with required inputs: ${preconditions.length}`,
		`  Total required params classified: ${total}`,
		`    tool (resolvable by another action): ${toolCount}`,
		`    user (must come from user/agent): ${userCount}`,
		`    tool_or_user (either source): ${toolOrUserCount}`,
		`    unknown: ${unknownCount}`,
	].join("\n");
}
