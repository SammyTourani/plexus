/**
 * Plexus eval harness — grades the dependency graph against a labeled task set.
 *
 * For each task, asks: does the graph correctly identify that the
 * required prior tools must run before the target tool?
 *
 * Metrics reported:
 *   - Precision: of edges graph proposes for this target, how many are correct?
 *   - Recall: of required prior tools, how many did the graph find?
 *   - F1: harmonic mean
 *
 * Usage:
 *   cd plexus/eval
 *   bun run grade.ts
 */

import { readFile, createReadStream } from "node:fs";
import * as readline from "node:readline";

interface Task {
	id: string;
	description: string;
	target_tool: string;
	required_prior_tools: string[];
	required_params: Record<string, string>;
	toolkit: string;
}

interface DependencyEdge {
	from: string;
	to: string;
	params: Array<{ inputParam: string; matchType: string; confidence: number }>;
	confidence: number;
}

interface DependencyGraph {
	nodes: Array<{ slug: string }>;
	edges: DependencyEdge[];
	metadata: Record<string, unknown>;
}

// Load graph.json
const graphPath = new URL(
	"../pipeline/output/graph.json",
	import.meta.url,
).pathname;
const graph: DependencyGraph = JSON.parse(
	await new Promise<string>((resolve, reject) => {
		readFile(graphPath, "utf-8", (err, data) =>
			err ? reject(err) : resolve(data),
		);
	}),
);

// Build producer index: consumer slug → set of producer slugs
const producersByCons = new Map<string, Set<string>>();
for (const edge of graph.edges) {
	if (!producersByCons.has(edge.to)) producersByCons.set(edge.to, new Set());
	producersByCons.get(edge.to)!.add(edge.from);
}

// Load tasks
const tasks: Task[] = [];
const rl = readline.createInterface({
	input: createReadStream(
		new URL("./tasks.jsonl", import.meta.url).pathname,
	),
	crlfDelay: Infinity,
});
for await (const line of rl) {
	if (line.trim()) tasks.push(JSON.parse(line));
}

// Grade each task
let totalTP = 0;
let totalFP = 0;
let totalFN = 0;

console.log(`\nPlexus Eval — ${tasks.length} tasks\n`);
console.log(
	`${"Task".padEnd(50)} ${"Required".padEnd(6)} ${"Found".padEnd(6)} ${"Recall".padEnd(8)} Status`,
);
console.log("─".repeat(85));

for (const task of tasks) {
	const graphProducers = producersByCons.get(task.target_tool) ?? new Set();
	const required = new Set(task.required_prior_tools);

	const tp = [...required].filter((t) => graphProducers.has(t)).length;
	const fp = [...graphProducers].filter((t) => !required.has(t)).length;
	const fn = [...required].filter((t) => !graphProducers.has(t)).length;

	totalTP += tp;
	totalFP += fp;
	totalFN += fn;

	const recall =
		required.size === 0 ? 1 : tp / (tp + fn);
	const status =
		required.size === 0
			? "N/A"
			: recall === 1
				? "✅ FULL"
				: recall > 0
					? "⚠️  PARTIAL"
					: "❌ MISSED";

	console.log(
		`${task.description.padEnd(50)} ${String(required.size).padEnd(6)} ${String(tp).padEnd(6)} ${(recall * 100).toFixed(0).padStart(5)}%   ${status}`,
	);
}

// Summary stats
const precision = totalTP + totalFP === 0 ? 0 : totalTP / (totalTP + totalFP);
const recall = totalTP + totalFN === 0 ? 0 : totalTP / (totalTP + totalFN);
const f1 =
	precision + recall === 0
		? 0
		: (2 * precision * recall) / (precision + recall);

console.log("\n" + "═".repeat(85));
console.log(`\nGraph edge coverage:`);
console.log(`  Total edges in graph : ${graph.edges.length}`);
console.log(`  Tasks evaluated      : ${tasks.length}`);
console.log(`  True positives       : ${totalTP}`);
console.log(`  False positives      : ${totalFP}`);
console.log(`  False negatives      : ${totalFN}`);
console.log(
	`\n  Precision : ${(precision * 100).toFixed(1)}%  (of graph's proposed edges, how many are correct)`,
);
console.log(
	`  Recall    : ${(recall * 100).toFixed(1)}%  (of required prior tools, how many did graph find)`,
);
console.log(`  F1 score  : ${(f1 * 100).toFixed(1)}%`);
console.log();
