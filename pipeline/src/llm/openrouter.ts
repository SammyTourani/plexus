import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import OpenAI from "openai";

const CACHE_DIR = "output/llm-cache";

const client = new OpenAI({
	baseURL: "https://openrouter.ai/api/v1",
	apiKey: process.env.OPENROUTER_API_KEY,
	timeout: 15000, // 15 second timeout per request
});

async function ensureCacheDir() {
	try {
		await access(CACHE_DIR);
	} catch {
		await mkdir(CACHE_DIR, { recursive: true });
	}
}

function cacheKey(prompt: string): string {
	return createHash("md5").update(prompt).digest("hex");
}

export async function llmComplete(
	systemPrompt: string,
	userPrompt: string,
	retries = 3,
): Promise<string> {
	await ensureCacheDir();

	const key = cacheKey(systemPrompt + userPrompt);
	const cachePath = `${CACHE_DIR}/${key}.json`;

	// Check cache
	try {
		await access(cachePath);
		const cached = JSON.parse(await readFile(cachePath, "utf-8"));
		return cached.response;
	} catch {
		// Not cached, proceed with API call
	}

	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			const completion = await client.chat.completions.create({
				model: "google/gemini-2.0-flash-001",
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "user", content: userPrompt },
				],
				temperature: 0.1,
				max_tokens: 4096,
			});

			const response = completion.choices[0]?.message?.content ?? "";

			// Cache the response
			await writeFile(
				cachePath,
				JSON.stringify({ prompt: userPrompt.slice(0, 200), response }),
				"utf-8",
			);

			return response;
		} catch (err) {
			const msg = err instanceof Error ? err.message : "unknown";
			// Don't retry on auth/credit errors
			if (
				msg.includes("402") ||
				msg.includes("401") ||
				msg.includes("Insufficient")
			) {
				console.log(`    LLM error (non-retryable): ${msg}`);
				return "";
			}
			if (attempt === retries) {
				console.log(`    LLM call failed after ${retries} attempts: ${msg}`);
				return "";
			}
			const delay = 1000 * 2 ** (attempt - 1);
			console.log(
				`    LLM attempt ${attempt} failed (${msg}), retrying in ${delay}ms...`,
			);
			await new Promise((r) => setTimeout(r, delay));
		}
	}

	return "";
}
