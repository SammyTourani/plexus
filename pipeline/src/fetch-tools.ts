import { access, readFile, writeFile } from "node:fs/promises";
import { Composio } from "@composio/core";
import type { ParamInfo, RawToolSchema, ToolNode } from "./types.ts";

const CACHE_DIR = "output";

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function fetchAndCacheToolkit(
	composio: Composio,
	toolkit: string,
): Promise<RawToolSchema[]> {
	const cachePath = `${CACHE_DIR}/${toolkit}_tools.json`;

	if (await fileExists(cachePath)) {
		console.log(`  Using cached ${toolkit} tools from ${cachePath}`);
		const raw = await readFile(cachePath, "utf-8");
		return JSON.parse(raw);
	}

	console.log(`  Fetching ${toolkit} tools from Composio API...`);
	const tools = await composio.tools.getRawComposioTools({
		toolkits: [toolkit],
		limit: 1000,
	});

	await writeFile(cachePath, JSON.stringify(tools, null, 2), "utf-8");
	console.log(`  Cached ${tools.length} ${toolkit} tools to ${cachePath}`);
	return tools as unknown as RawToolSchema[];
}

function extractParams(schema: RawToolSchema["inputParameters"]): ParamInfo[] {
	if (!schema?.properties) return [];
	const required = new Set(schema.required ?? []);

	return Object.entries(schema.properties).map(([name, prop]) => ({
		name,
		type: Array.isArray(prop.type)
			? (prop.type[0] ?? "unknown")
			: (prop.type ?? "unknown"),
		description: prop.description ?? "",
		required: required.has(name),
	}));
}

function parseToolNode(raw: RawToolSchema): ToolNode {
	return {
		slug: raw.slug,
		name: raw.name,
		description: raw.description ?? "",
		toolkit: raw.toolkit?.slug ?? "unknown",
		inputs: extractParams(raw.inputParameters),
		isDeprecated: raw.isDeprecated ?? false,
		tags: raw.tags ?? [],
	};
}

export async function fetchAllTools(): Promise<{
	nodes: ToolNode[];
	rawTools: RawToolSchema[];
}> {
	const composio = new Composio();

	console.log("Fetching tools...");
	const [gsRaw, ghRaw] = await Promise.all([
		fetchAndCacheToolkit(composio, "googlesuper"),
		fetchAndCacheToolkit(composio, "github"),
	]);

	const allRaw = [...gsRaw, ...ghRaw];
	const nodes = allRaw.map(parseToolNode);

	console.log(
		`  Total: ${nodes.length} tools (Google Super: ${gsRaw.length}, GitHub: ${ghRaw.length})`,
	);

	return { nodes, rawTools: allRaw };
}
