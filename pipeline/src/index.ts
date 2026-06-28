import { writeFile } from "node:fs/promises";
import { fetchAllTools } from "./fetch-tools.ts";
import { addLLMEdges, buildGraph } from "./graph/builder.ts";
import {
	buildPreconditions,
	summarizePreconditions,
} from "./graph/preconditions.ts";
import { validateGraph } from "./graph/validate.ts";
import {
	printCrossReferenceReport,
	runCrossReference,
} from "./meta/cross-reference.ts";
import { generateHTML } from "./viz/html-generator.ts";

async function main() {
	const startTime = Date.now();
	console.log("=== Composio Tool Dependency Graph Builder ===\n");

	// Step 1: Fetch and parse tools
	const { nodes, rawTools } = await fetchAllTools();

	// Step 2: Build dependency graph (description + heuristic + targeted rules)
	const graph = buildGraph(nodes, rawTools);

	// Step 3: LLM enhancement (optional — fail fast if no credits)
	if (process.env.OPENROUTER_API_KEY) {
		try {
			const { runSemanticMatching } = await import("./llm/semantic-matcher.ts");
			const llmEdges = await runSemanticMatching(rawTools);
			if (llmEdges.length > 0) addLLMEdges(graph, llmEdges);
		} catch (err) {
			console.log(
				`  LLM skipped: ${err instanceof Error ? err.message : "error"}`,
			);
		}
	} else {
		console.log("\n  LLM enhancement: skipped (no OPENROUTER_API_KEY)");
	}

	// Step 4: Validate against golden set
	console.log("");
	const validation = validateGraph(graph);
	console.log(validation.summary);

	// Step 5: Cross-reference against Composio's SEARCH_TOOLS meta-tool
	if (process.env.COMPOSIO_API_KEY) {
		console.log("\nCross-referencing with Composio SEARCH_TOOLS...");
		try {
			const report = await runCrossReference(graph);
			printCrossReferenceReport(report);
		} catch (err) {
			console.log(
				`  Cross-reference skipped: ${err instanceof Error ? err.message : "error"}`,
			);
		}
	}

	// Step 6: Build preconditions (input resolution: tool vs user)
	console.log("");
	const preconditions = buildPreconditions(graph);
	console.log(summarizePreconditions(preconditions));
	await writeFile(
		"output/preconditions.json",
		JSON.stringify(preconditions, null, 2),
		"utf-8",
	);
	console.log("  Saved to output/preconditions.json");

	// Step 7: Save outputs
	await writeFile("output/graph.json", JSON.stringify(graph, null, 2), "utf-8");

	const html = generateHTML(graph);
	await writeFile("output/graph.html", html, "utf-8");

	// Step 8: Summary
	const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
	console.log(`\n=== Done in ${elapsed}s ===`);
	console.log(
		`  ${graph.metadata.totalTools} tools, ${graph.metadata.totalEdges} edges`,
	);
	console.log(`  Edge types:`, graph.metadata.edgesByType);
	console.log(
		`  Validation: ${validation.passed ? "ALL PASSED" : "SOME FAILED"}`,
	);
	console.log(
		`  Output: output/graph.html, output/graph.json, output/preconditions.json`,
	);

	if (!validation.passed) process.exit(1);
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
