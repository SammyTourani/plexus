import type { DependencyEdge, ParamLink, RawToolSchema } from "../types.ts";
import { llmComplete } from "./openrouter.ts";

interface LLMDep {
	producer: string;
	consumer: string;
	inputParam: string;
	reason: string;
}

function getServicePrefix(slug: string): string {
	// Group by the first meaningful segment after toolkit prefix
	// GOOGLESUPER_LIST_THREADS → based on description/tags, group by service
	const action = slug.replace(/^(GOOGLESUPER_|GITHUB_)/, "");
	const parts = action.split("_");

	// For Google Super, try to infer service from slug patterns
	if (slug.startsWith("GOOGLESUPER_")) {
		if (
			action.match(
				/^(EMAIL|THREAD|DRAFT|LABEL|FILTER|SEND|REPLY|BATCH_DELETE_MESSAGES|BATCH_MODIFY_MESSAGES|FETCH_EMAIL|FETCH_MESSAGE|LIST_THREAD|LIST_DRAFT|LIST_FILTER|LIST_LABEL|GET_DRAFT|GET_ATTACHMENT|LIST_HISTORY|GET_PROFILE|SEND_DRAFT|UPDATE_DRAFT|DELETE_DRAFT|MODIFY_THREAD|MOVE_THREAD|UNTRASH_THREAD|CREATE_LABEL|DELETE_LABEL|PATCH_LABEL|ADD_LABEL|CREATE_EMAIL)/,
			)
		)
			return "GS_GMAIL";
		if (
			action.match(
				/^(CALENDAR|EVENT|ACL|FREEBUSY|COLOR|CLEAR_CALENDAR|PATCH_CALENDAR|DUPLICATE|BATCH_EVENT|CHANNEL)/,
			)
		)
			return "GS_CALENDAR";
		if (
			action.match(
				/^(FILE|FOLDER|DRIVE|PERMISSION|REVISION|CHANGE|UPLOAD|DOWNLOAD|COPY_FILE|EDIT_FILE|ADD_PARENT|ADD_PROPERTY|FIND_FILE|FIND_FOLDER|LIST_FILE|GET_FILE|SHARED_DRIVE|LIST_SHARED)/,
			)
		)
			return "GS_DRIVE";
		if (
			action.match(
				/^(SHEET|SPREADSHEET|CELL|DIMENSION|CHART|VALUES|COLUMN|ROW|DATA_VALIDATION|CONDITIONAL_FORMAT|TABLE|BATCH_GET|BATCH_UPDATE|BATCH_CLEAR|CLEAR_VALUE|CLEAR_BASIC|FORMAT_CELL|AGGREGATE|ADD_SHEET|AUTO_RESIZE|APPEND_DIMENSION|DELETE_DIMENSION|QUERY_TABLE|SET_DATA|UPDATE_DIMENSION|UPDATE_SPREADSHEET|MUTATE_CONDITIONAL)/,
			)
		)
			return "GS_SHEETS";
		if (
			action.match(
				/^(DOCUMENT|FOOTER|HEADER|INSERT_TEXT|MARKDOWN|GET_DOCUMENT|SEARCH_DOCUMENT|CREATE_DOCUMENT|UPDATE_DOCUMENT|UPDATE_EXISTING)/,
			)
		)
			return "GS_DOCS";
		if (
			action.match(
				/^(ALBUM|MEDIA|PHOTO|ENRICHMENT|BATCH_ADD_MEDIA|BATCH_CREATE_MEDIA|BATCH_GET_MEDIA|CREATE_ALBUM|LIST_ALBUM|GET_ALBUM|SEARCH_MEDIA|LIST_SHARED_ALBUM|JOIN_ALBUM|SHARE_ALBUM|UNSHARE_ALBUM)/,
			)
		)
			return "GS_PHOTOS";
		if (
			action.match(
				/^(TASK|TASKLIST|BULK_INSERT_TASK|CLEAR_TASK|INSERT_TASK|LIST_TASK|DELETE_TASK|GET_TASK|MOVE_TASK|PATCH_TASK|UPDATE_TASK)/,
			)
		)
			return "GS_TASKS";
		if (
			action.match(
				/^(REPORT|METRIC|AUDIENCE|PROPERTY|ACCOUNT|ARCHIVE_CUSTOM|CHECK_COMPATIBILITY|RUN_REPORT|RUN_REALTIME|LIST_PROPERTIES|LIST_ACCOUNTS|GET_METADATA|CREATE_AUDIENCE|BATCH_RUN)/,
			)
		)
			return "GS_ANALYTICS";
		return "GS_OTHER";
	}

	// For GitHub, group by the first word or two
	if (slug.startsWith("GITHUB_")) {
		if (
			action.match(
				/^(LIST_ISSUES|CREATE.*ISSUE|GET.*ISSUE|ADD.*ISSUE|REMOVE.*ISSUE|UPDATE.*ISSUE|LOCK|UNLOCK|ADD_ASSIGNEE|ADD_LABEL|ADD_SUB|REMOVE_SUB|REPRIORITIZE_SUB)/,
			)
		)
			return "GH_ISSUES";
		if (
			action.match(
				/^(LIST_PULL|CREATE.*PULL|GET.*PULL|MERGE|UPDATE.*PULL|CHECK_PULL|FIND_PULL|REQUEST_REVIEW|REMOVE_REVIEW|LIST_REVIEW|CREATE_REVIEW|SUBMIT_REVIEW|DISMISS_REVIEW|LIST_COMMIT|LIST_FILE)/,
			)
		)
			return "GH_PULLS";
		if (
			action.match(
				/^(LIST_REPO|CREATE.*REPO|GET.*REPO|DELETE.*REPO|UPDATE.*REPO|FORK|TRANSFER|LIST_BRANCH|CREATE_BRANCH|DELETE_BRANCH|GET_BRANCH|LIST_TAG|CREATE_TAG|RENAME_BRANCH|LIST_COLLABORATOR|ADD.*COLLABORATOR|REMOVE.*COLLABORATOR|CHECK.*COLLABORATOR|LIST_CONTRIBUTOR)/,
			)
		)
			return "GH_REPOS";
		if (
			action.match(
				/^(LIST_WORKFLOW|GET_WORKFLOW|CREATE_WORKFLOW|CANCEL_WORKFLOW|RE_RUN|APPROVE_WORKFLOW|LIST_JOB|GET_WORKFLOW_RUN|DOWNLOAD_JOB|DELETE_WORKFLOW|ENABLE_WORKFLOW|DISABLE_WORKFLOW|FORCE_CANCEL|REVIEW_CUSTOM|LIST_RUNNER|CREATE_RUNNER|DELETE_RUNNER|REMOVE_RUNNER|ADD.*RUNNER|LIST_SELF|CREATE_SELF|DELETE_SELF|GET_SELF|ADD_CUSTOM_LABELS|CREATE_REGISTRATION|LIST_ORGANIZATION_VARIABLE|CREATE_ORGANIZATION_VARIABLE|DELETE_ORGANIZATION_VARIABLE|UPDATE_ORGANIZATION_VARIABLE|GET_ORGANIZATION_VARIABLE|LIST_ENVIRONMENT|CREATE_ENVIRONMENT|DELETE_ENVIRONMENT|GET_ENVIRONMENT)/,
			)
		)
			return "GH_ACTIONS";
		if (
			action.match(
				/^(LIST_ORG|CREATE_ORG|GET_ORG|UPDATE_ORG|DELETE_ORG|LIST_MEMBER|REMOVE_MEMBER|CONVERT_MEMBER|CHECK_MEMBER|SET_MEMBER|LIST_PENDING|LIST_OUTSIDE|CONVERT_OUTSIDE|REMOVE_OUTSIDE|ASSIGN_ORG|LIST_TEAM|CREATE_TEAM|DELETE_TEAM|GET_TEAM|UPDATE_TEAM|ADD_TEAM|REMOVE_TEAM|LIST_CHILD|CHECK_TEAM)/,
			)
		)
			return "GH_ORGS";
		if (
			action.match(
				/^(GET_AUTHENTICATED|LIST_USER|GET_USER|LIST_FOLLOWER|LIST_FOLLOWING|CHECK_FOLLOWING|FOLLOW|UNFOLLOW|LIST_GPG|LIST_SSH|LIST_PUBLIC|ADD_EMAIL|DELETE_EMAIL|LIST_EMAIL|ADD_SOCIAL|DELETE_SOCIAL|LIST_SOCIAL|SET_PRIMARY|BLOCK_USER|UNBLOCK_USER|CHECK_BLOCKED|LIST_BLOCKED)/,
			)
		)
			return "GH_USERS";
		if (
			action.match(
				/^(CREATE_COMMIT|GET_COMMIT|LIST_COMMIT|COMPARE_COMMIT|CREATE_BLOB|CREATE_TREE|GET_TREE|CREATE_REF|DELETE_REF|GET_REF|UPDATE_REF|LIST_MATCHING|COMMIT_MULTIPLE)/,
			)
		)
			return "GH_GIT";
		if (
			action.match(
				/^(CREATE_DEPLOY|GET_DEPLOY|LIST_DEPLOY|DELETE_DEPLOY|CREATE_DEPLOYMENT_STATUS|LIST_DEPLOYMENT_STATUS|GET_DEPLOYMENT_STATUS|CREATE_DEPLOYMENT_BRANCH|DELETE_DEPLOYMENT_BRANCH|GET_DEPLOYMENT_BRANCH|LIST_DEPLOYMENT_BRANCH|CANCEL_PAGES|CREATE_PAGES|DELETE_PAGES|GET_PAGES|UPDATE_PAGES|LIST_PAGES)/,
			)
		)
			return "GH_DEPLOYS";
		return "GH_OTHER";
	}

	return parts.slice(0, 2).join("_");
}

function buildToolSummary(tool: RawToolSchema): string {
	const required = tool.inputParameters?.required ?? [];
	const props = tool.inputParameters?.properties ?? {};

	const requiredParams = required
		.map((name) => {
			const prop = props[name];
			const desc = (prop as any)?.description?.slice(0, 80) ?? "";
			return `  - ${name}: ${desc}`;
		})
		.join("\n");

	return `${tool.slug} - ${tool.name}\n  Description: ${tool.description?.slice(0, 120) ?? ""}\n  Required inputs:\n${requiredParams || "  (none)"}`;
}

function parseResponse(response: string, slugSet: Set<string>): LLMDep[] {
	// Extract JSON array from response (handle markdown code blocks)
	const jsonMatch = response.match(/\[[\s\S]*\]/);
	if (!jsonMatch) return [];

	try {
		const parsed = JSON.parse(jsonMatch[0]);
		if (!Array.isArray(parsed)) return [];

		return parsed
			.filter(
				(d: any) =>
					typeof d.producer === "string" &&
					typeof d.consumer === "string" &&
					typeof d.inputParam === "string" &&
					slugSet.has(d.producer) &&
					slugSet.has(d.consumer) &&
					d.producer !== d.consumer,
			)
			.map((d: any) => ({
				producer: d.producer,
				consumer: d.consumer,
				inputParam: d.inputParam,
				reason: d.reason ?? "LLM-identified dependency",
			}));
	} catch {
		return [];
	}
}

export async function runSemanticMatching(
	rawTools: RawToolSchema[],
): Promise<DependencyEdge[]> {
	console.log("\nRunning LLM semantic matching...");

	const slugSet = new Set(rawTools.map((t) => t.slug));

	// Group tools by service prefix
	const groups = new Map<string, RawToolSchema[]>();
	for (const tool of rawTools) {
		const prefix = getServicePrefix(tool.slug);
		if (!groups.has(prefix)) groups.set(prefix, []);
		groups.get(prefix)?.push(tool);
	}

	console.log(`  ${groups.size} service groups to analyze`);

	const systemPrompt = `You analyze API tool dependencies for an agentic system. Given a group of tools with their required input parameters, identify which tools must run BEFORE other tools to provide required input data.

Rules:
- A dependency means Tool A produces data that Tool B needs as a required input
- LIST/SEARCH/GET tools typically produce IDs and data that CRUD tools consume
- Focus on entity IDs, references, and data that flows between tools
- Only include dependencies where you are confident the relationship exists
- Do NOT include trivial or obvious dependencies on generic params like "owner" or "repo"

Return ONLY a JSON array (no markdown, no explanation):
[{"producer": "TOOL_SLUG", "consumer": "TOOL_SLUG", "inputParam": "param_name", "reason": "brief explanation"}]

If no dependencies found, return: []`;

	const allDeps: LLMDep[] = [];
	let groupIndex = 0;
	let consecutiveFailures = 0;

	for (const [prefix, tools] of groups) {
		groupIndex++;
		// Skip very small groups (likely already well-covered by heuristics)
		if (tools.length < 3) continue;

		// Bail out early if LLM keeps failing (e.g., no credits)
		if (consecutiveFailures >= 3) {
			console.log(
				`  Stopping LLM matching after ${consecutiveFailures} consecutive failures`,
			);
			break;
		}

		// Skip very large groups (would exceed context) — take a sample
		const toolsToAnalyze = tools.length > 40 ? tools.slice(0, 40) : tools;

		const toolSummaries = toolsToAnalyze.map(buildToolSummary).join("\n\n");

		const userPrompt = `Analyze these ${toolsToAnalyze.length} tools from the "${prefix}" service group and identify dependency relationships:\n\n${toolSummaries}`;

		process.stdout.write(
			`  [${groupIndex}/${groups.size}] ${prefix} (${toolsToAnalyze.length} tools)... `,
		);

		const response = await llmComplete(systemPrompt, userPrompt);
		if (!response) {
			consecutiveFailures++;
			console.log(`failed`);
			continue;
		}
		consecutiveFailures = 0;
		const deps = parseResponse(response, slugSet);
		allDeps.push(...deps);
		console.log(`${deps.length} deps`);
	}

	// Convert to DependencyEdges
	const edgeMap = new Map<string, DependencyEdge>();
	for (const dep of allDeps) {
		const key = `${dep.producer}→${dep.consumer}`;
		const link: ParamLink = {
			inputParam: dep.inputParam,
			producerSlug: dep.producer,
			reason: dep.reason,
			matchType: "llm",
			evidence: "inferred",
		};

		if (edgeMap.has(key)) {
			edgeMap.get(key)?.params.push(link);
		} else {
			edgeMap.set(key, {
				from: dep.producer,
				to: dep.consumer,
				params: [link],
				confidence: 0.75,
			});
		}
	}

	const edges = [...edgeMap.values()];
	console.log(
		`  LLM total: ${edges.length} unique edges from ${allDeps.length} dependencies`,
	);
	return edges;
}
