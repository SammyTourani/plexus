/**
 * Standalone validation — loads the committed graph.json and runs the
 * full golden-set check. Used as a CI gate on every push.
 *
 * Usage: bun run src/validate-standalone.ts
 */
import { readFile } from "node:fs/promises";
import { validateGraph } from "./graph/validate.ts";
import type { DependencyGraph } from "./types.ts";

const graphPath = new URL("../output/graph.json", import.meta.url).pathname;

let graph: DependencyGraph;
try {
	const raw = await readFile(graphPath, "utf-8");
	graph = JSON.parse(raw);
} catch (err) {
	console.error(`Cannot read ${graphPath}:`, err);
	process.exit(1);
}

console.log(
	`Loaded graph: ${graph.metadata.totalTools} tools, ${graph.metadata.totalEdges} edges`,
);
console.log(`Generated: ${graph.metadata.generatedAt}\n`);

const result = validateGraph(graph);
console.log(result.summary);

if (!result.passed) {
	console.error("\n❌ Validation failed — see failures above.");
	process.exit(1);
}

console.log("\n✅ All checks passed.");
