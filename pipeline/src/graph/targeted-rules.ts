import type { DependencyEdge, RawToolSchema } from "../types.ts";

/**
 * Targeted, evidence-driven dependency rules for specific cases that
 * neither description parsing nor slug heuristics can catch.
 *
 * Each rule is justified by real-world workflow semantics or API data-flow analysis.
 */
export function extractTargetedDeps(
	rawTools: RawToolSchema[],
	existingEdgeKeys: Set<string>,
): DependencyEdge[] {
	const slugSet = new Set(rawTools.map((t) => t.slug));
	const edges: DependencyEdge[] = [];

	function addEdge(
		from: string,
		to: string,
		inputParam: string,
		reason: string,
	) {
		if (!slugSet.has(from) || !slugSet.has(to)) return;
		if (from === to) return;
		const key = `${from}→${to}`;
		if (existingEdgeKeys.has(key)) return;

		edges.push({
			from,
			to,
			params: [
				{
					inputParam,
					producerSlug: from,
					reason,
					matchType: "targeted",
					evidence: "explicit",
				},
			],
			confidence: 0.85,
		});
		existingEdgeKeys.add(key);
	}

	// ─── Contact lookup → Send Email ───
	//
	// GOOGLESUPER_SEND_EMAIL requires recipient_email.
	// When only a person's name is known, a contact/people lookup must run first
	// to resolve it to an email address.
	//
	// GOOGLESUPER_SEARCH_PEOPLE searches contacts by name → returns email addresses.
	// GOOGLESUPER_GET_CONTACTS fetches saved contacts → returns email addresses.
	// GOOGLESUPER_GET_PEOPLE retrieves person details → returns email addresses.

	addEdge(
		"GOOGLESUPER_SEARCH_PEOPLE",
		"GOOGLESUPER_SEND_EMAIL",
		"recipient_email",
		"Contact search resolves person name → email address for recipient",
	);

	addEdge(
		"GOOGLESUPER_GET_CONTACTS",
		"GOOGLESUPER_SEND_EMAIL",
		"recipient_email",
		"Contact list provides email addresses for recipients",
	);

	addEdge(
		"GOOGLESUPER_GET_PEOPLE",
		"GOOGLESUPER_SEND_EMAIL",
		"recipient_email",
		"People lookup resolves person → email address",
	);

	// ─── Gmail: label resolution ───
	// GMAIL_CREATE_LABEL produces a label_id that other tools need.
	// Many tools reference label IDs but descriptions don't always cite CREATE_LABEL.

	addEdge(
		"GOOGLESUPER_CREATE_LABEL",
		"GOOGLESUPER_DELETE_LABEL",
		"label_id",
		"Delete requires a label_id produced by create or list",
	);

	// ─── Google Sheets: create spreadsheet → any spreadsheet operation ───
	addEdge(
		"GOOGLESUPER_CREATE_SPREADSHEET",
		"GOOGLESUPER_ADD_SHEET",
		"spreadsheetId",
		"New spreadsheet must exist before adding sheets to it",
	);

	addEdge(
		"GOOGLESUPER_CREATE_SPREADSHEET",
		"GOOGLESUPER_CLEAR_VALUES",
		"spreadsheet_id",
		"Spreadsheet must exist before clearing values",
	);

	// ─── GitHub: create repo → operations on repo ───
	// Not adding generic owner/repo edges, but the CREATE → specific operations pattern
	addEdge(
		"GITHUB_CREATE_A_REPOSITORY",
		"GITHUB_CREATE_A_DEPLOYMENT",
		"repo",
		"Repository must exist before creating deployments",
	);

	console.log(`  Targeted rules: ${edges.length} edges added`);
	return edges;
}
