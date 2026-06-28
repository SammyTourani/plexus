export interface ParamInfo {
	name: string;
	type: string;
	description: string;
	required: boolean;
}

export interface ToolNode {
	slug: string;
	name: string;
	description: string;
	toolkit: string;
	inputs: ParamInfo[];
	isDeprecated: boolean;
	tags: string[];
}

export interface ParamLink {
	inputParam: string;
	producerSlug: string;
	reason: string;
	matchType: "description" | "heuristic" | "targeted" | "llm";
	/** Whether the evidence is explicit (from docs) or inferred (from heuristics) */
	evidence: "explicit" | "inferred";
}

export interface DependencyEdge {
	from: string; // producer tool slug
	to: string; // consumer tool slug
	params: ParamLink[];
	confidence: number;
}

export interface DependencyGraph {
	nodes: ToolNode[];
	edges: DependencyEdge[];
	metadata: {
		totalTools: number;
		totalEdges: number;
		edgesByType: Record<string, number>;
		toolkits: string[];
		generatedAt: string;
	};
}

// Raw tool type from Composio SDK
export interface RawToolSchema {
	slug: string;
	name: string;
	description?: string;
	inputParameters?: {
		type: string;
		properties: Record<string, JsonSchemaProperty>;
		required?: string[];
		title?: string;
	};
	outputParameters?: {
		type: string;
		properties: Record<string, JsonSchemaProperty>;
		required?: string[];
		title?: string;
	};
	toolkit?: { slug: string; name: string };
	tags?: string[];
	version?: string;
	isDeprecated?: boolean;
}

export interface JsonSchemaProperty {
	type?: string | string[];
	description?: string;
	title?: string;
	properties?: Record<string, JsonSchemaProperty>;
	items?: JsonSchemaProperty | JsonSchemaProperty[];
	required?: string[];
	enum?: unknown[];
	examples?: unknown[];
	default?: unknown;
	$ref?: string;
}
