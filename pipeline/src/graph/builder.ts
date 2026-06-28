import type {
	DependencyEdge,
	DependencyGraph,
	RawToolSchema,
	ToolNode,
} from "../types.ts";
import { extractDescriptionDeps } from "./description-matcher.ts";
import { extractSlugDeps } from "./slug-matcher.ts";
import { extractTargetedDeps } from "./targeted-rules.ts";

export function buildGraph(
	nodes: ToolNode[],
	rawTools: RawToolSchema[],
): DependencyGraph {
	console.log("\nBuilding dependency graph...");

	// Strategy 1: Description-based matching (highest confidence)
	const descEdges = extractDescriptionDeps(rawTools);

	// Collect existing edge keys so slug matcher can skip duplicates
	const existingKeys = new Set(descEdges.map((e) => `${e.from}→${e.to}`));

	// Strategy 2: Slug-based heuristic matching
	const slugEdges = extractSlugDeps(rawTools, existingKeys);

	// Update existing keys with slug edges
	for (const e of slugEdges) existingKeys.add(`${e.from}→${e.to}`);

	// Strategy 3: Targeted, evidence-driven rules for specific workflows
	const targetedEdges = extractTargetedDeps(rawTools, existingKeys);

	// Merge all edges
	const allEdges = [...descEdges, ...slugEdges, ...targetedEdges];

	// Final deduplication: merge edges between same tool pairs
	const edgeMap = new Map<string, DependencyEdge>();
	for (const edge of allEdges) {
		const key = `${edge.from}→${edge.to}`;
		const existing = edgeMap.get(key);
		if (existing) {
			existing.params.push(...edge.params);
			existing.confidence = Math.max(existing.confidence, edge.confidence);
		} else {
			edgeMap.set(key, { ...edge });
		}
	}

	const edges = [...edgeMap.values()].sort(
		(a, b) => b.confidence - a.confidence,
	);

	// Count edges by type
	const edgesByType: Record<string, number> = {};
	for (const edge of edges) {
		for (const param of edge.params) {
			edgesByType[param.matchType] = (edgesByType[param.matchType] ?? 0) + 1;
		}
	}

	const graph: DependencyGraph = {
		nodes,
		edges,
		metadata: {
			totalTools: nodes.length,
			totalEdges: edges.length,
			edgesByType,
			toolkits: ["googlesuper", "github"],
			generatedAt: new Date().toISOString(),
		},
	};

	console.log(`\nGraph built:`);
	console.log(`  Nodes: ${graph.metadata.totalTools}`);
	console.log(`  Edges: ${graph.metadata.totalEdges}`);
	console.log(`  By type:`, graph.metadata.edgesByType);

	return graph;
}

export function addLLMEdges(
	graph: DependencyGraph,
	llmEdges: DependencyEdge[],
): DependencyGraph {
	const existingKeys = new Set(graph.edges.map((e) => `${e.from}→${e.to}`));
	let newCount = 0;
	let boostedCount = 0;

	for (const llmEdge of llmEdges) {
		const key = `${llmEdge.from}→${llmEdge.to}`;
		if (existingKeys.has(key)) {
			// LLM confirms existing edge — boost confidence
			const existing = graph.edges.find(
				(e) => e.from === llmEdge.from && e.to === llmEdge.to,
			);
			if (existing) {
				existing.confidence = Math.min(0.98, existing.confidence + 0.05);
				existing.params.push(...llmEdge.params);
				boostedCount++;
			}
		} else {
			// New edge from LLM
			graph.edges.push(llmEdge);
			existingKeys.add(key);
			newCount++;
		}
	}

	// Update metadata
	graph.metadata.totalEdges = graph.edges.length;
	const edgesByType: Record<string, number> = {};
	for (const edge of graph.edges) {
		for (const param of edge.params) {
			edgesByType[param.matchType] = (edgesByType[param.matchType] ?? 0) + 1;
		}
	}
	graph.metadata.edgesByType = edgesByType;

	console.log(
		`  LLM: ${newCount} new edges, ${boostedCount} existing edges boosted`,
	);

	return graph;
}
