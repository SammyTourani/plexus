# Plexus — Methodology

## Problem

When an LLM agent executes Composio tools, some tools require data produced by other tools first. For example, `GOOGLESUPER_REPLY_TO_THREAD` needs a `thread_id`, which must come from `GOOGLESUPER_LIST_THREADS` or `GOOGLESUPER_FETCH_EMAILS`. This project discovers and visualizes these dependency relationships across 1,296 tools (429 Google Super + 867 GitHub).

The output answers two questions for every tool:
1. **What other tool must run first?** (the dependency graph)
2. **What must the user provide vs. what can another tool provide?** (the preconditions artifact)

## Technical approach

Four strategies are applied in order of confidence, each building on the previous:

### Strategy 1: Description Parsing (confidence: 0.95)

Many input parameter descriptions **explicitly reference** the tools that produce them.

Example — `GOOGLESUPER_REPLY_TO_THREAD.thread_id`:
> *"...use GMAIL_LIST_THREADS..."*

We extract these references with regex, resolve legacy service-specific aliases (`GMAIL_` → `GOOGLESUPER_`, `GOOGLEDRIVE_` → `GOOGLESUPER_`, etc.), and validate that the resolved slug exists in the dataset. This produces ~111 high-confidence, Composio-engineer-verified edges.

### Strategy 2: Slug-Based Heuristic Matching (confidence: 0.6–0.8)

For required input parameters that look like entity references (ending in `_id`, `_ids`, `Id`, `_number`), we extract the entity name and search for same-toolkit tools whose slug contains a producer verb (`LIST_`, `SEARCH_`, `FETCH_`, `FIND_`, `GET_`, `CREATE_`) followed by that entity.

Example: `event_id` → matches `GOOGLESUPER_LIST_EVENTS`, `GOOGLESUPER_FIND_EVENT`.

Safeguards:
- Only matches **required** input params (optional params create false edges)
- Skips ~70 generic params (`id`, `name`, `owner`, `repo`, etc.)
- Limits to 3 producer candidates per (consumer, param) pair
- Never creates cross-toolkit edges (Google Super ↔ GitHub)
- Skips known "weak producer" patterns (mutators, toggles, config setters)

### Strategy 3: Targeted Rules (confidence: 0.85)

Hand-written rules for specific workflows that neither description parsing nor slug heuristics can capture. Each rule is grounded in real API workflow semantics.

Key example — **Contact lookup → Send Email**:

The Gmail API's `SEND_EMAIL` requires `recipient_email`. When only a person's name is available, an agent must first resolve it via `SEARCH_PEOPLE` or `GET_CONTACTS`. This is a semantic dependency that string matching cannot discover.

`GOOGLESUPER_SEARCH_PEOPLE` / `GOOGLESUPER_GET_CONTACTS` → `GOOGLESUPER_SEND_EMAIL` via `recipient_email`.

### Strategy 4: LLM Semantic Matching (confidence: 0.75, optional)

Groups tools by service prefix and sends each group to an LLM via OpenRouter (Gemini 2.0 Flash) to identify semantic dependencies that string matching misses. Results are cached deterministically by prompt hash. Gracefully skipped if no API key is present.

## Confidence tiers

| Tier | Score | Source | Meaning |
|------|-------|--------|---------|
| Explicit | 0.95 | Description parsing | Composio engineers documented this dependency |
| Targeted | 0.85 | Hand-written rules | Justified by API semantics or real workflow analysis |
| Heuristic | 0.6–0.8 | Slug matching | Entity ID param maps to a LIST/GET/SEARCH tool |
| Semantic | 0.75 | LLM analysis | LLM identified a plausible dependency |

## Validation

A golden-set test suite runs on every build:

**Must-have edges** (10 verified cases — all pass):
- ✓ LIST_THREADS → REPLY_TO_THREAD [thread_id]
- ✓ LIST_THREADS → FETCH_MESSAGE_BY_THREAD_ID [thread_id]
- ✓ SEARCH_PEOPLE → SEND_EMAIL [recipient_email]
- ✓ GET_CONTACTS → SEND_EMAIL [recipient_email]
- ✓ LIST_ARTIFACTS → DOWNLOAD_AN_ARTIFACT [artifact_id]
- ✓ LIST_DRAFTS → DELETE_DRAFT [draft_id]
- ✓ FIND_FILE → EDIT_FILE [file_id]
- ✓ LIST_LABELS → BATCH_MODIFY_MESSAGES [addLabelIds]
- ✓ FETCH_EMAILS → ADD_LABEL_TO_EMAIL [message_id]
- ✓ LIST_CALENDARS → CREATE_EVENT [calendar_id]

**Must-not-have rules** (4 rules — all pass):
- ✓ No self-reference edges
- ✓ No heuristic edges based solely on generic params (owner/repo/name/id)
- ✓ No cross-toolkit edges
- ✓ No destructive tools acting as high-degree producers (>5 edges)

## Eval harness (eval/)

`eval/tasks.jsonl` contains 20 labeled multi-step tasks specifying which prior tools are required for each target tool. `eval/grade.ts` scores the graph's edges against this set.

**Current scores (run `bun run eval/grade.ts` from project root):**

| Metric | Score |
|---|---|
| Precision | 34.1% |
| Recall | 46.9% |
| F1 | 39.5% |

These numbers reflect the heuristic strategy's intentional conservatism. The slug matcher caps producers at 3 per parameter and skips generics — reducing false edges at the cost of recall. Full precision/recall breakdown by strategy is forthcoming.

## Preconditions artifact

The `preconditions.json` output answers both halves of the agent-planning question by classifying each required input parameter:

| Resolution | Meaning |
|---|---|
| `tool` | Must be obtained from another tool (e.g., `thread_id` from LIST_THREADS) |
| `user` | Must come from the user or calling agent (e.g., `subject`, `body`) |
| `tool_or_user` | Either source works (e.g., `recipient_email` — user may know it, or resolve via contacts) |
| `unknown` | Could not determine source |

### Conditional requirements

Many tools have no schema-level `required[]` but their descriptions contain conditional requirements like *"at least one of X, Y, or Z must be provided"*. Plexus detects these patterns and includes them as `conditionalInputs`.

**Example — GOOGLESUPER_SEND_EMAIL:**

SEND_EMAIL has zero schema-required params, but descriptions reveal:
- *"At least one of recipient_email, cc, or bcc must be provided"*
- *"Either subject or body must be provided"*

Plexus output:
```json
{
  "tool": "GOOGLESUPER_SEND_EMAIL",
  "conditionalInputs": [
    {
      "condition": "At least one required: recipient_email, cc, or bcc",
      "params": [
        { "name": "recipient_email", "resolution": "tool_or_user",
          "candidateTools": ["GOOGLESUPER_SEARCH_PEOPLE", "GOOGLESUPER_GET_CONTACTS"] },
        { "name": "cc", "resolution": "user" },
        { "name": "bcc", "resolution": "user" }
      ]
    }
  ]
}
```

## Known limitations

1. **Output schemas are opaque.** All 1,296 tools return `{data: $ref(unresolved), error, successful}` with no detailed field names. Dependency discovery relies entirely on input parameter analysis — we cannot match output fields to input fields directly.

2. **Coverage is partial.** ~25% of tools appear in dependency edges. Many tools (utility tools, no-prerequisite reads) have no meaningful precursor — they correctly have no edges.

3. **Heuristic edges can be noisy.** Entity-ID matching may connect tools that share an ID type but aren't a natural workflow pair. The confidence score reflects this; the eval harness measures it (34.1% precision).

4. **LLM enhancement is API-key dependent.** The pipeline degrades gracefully without OpenRouter credentials. The LLM cache ensures deterministic re-runs once seeded.

## Output files

- `pipeline/output/graph.json` — Full dependency graph with nodes, edges, confidence scores, match types, and parameter-level justifications
- `pipeline/output/preconditions.json` — Input resolution for every tool: classifies each required/conditional parameter
- `eval/tasks.jsonl` — 20 labeled tasks for precision/recall evaluation
