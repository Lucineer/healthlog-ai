# healthlog-ai 🩺

You track your health, workouts, meals, and sleep. This agent runs on your Cloudflare account. It logs entries only to your private key-value store and can optionally spot patterns. Your data is never sent to our servers.

**Live demo:** [healthlog-ai.casey-digennaro.workers.dev](https://healthlog-ai.casey-digennaro.workers.dev)

## Quick Start
1.  **Fork** this repository.
2.  Deploy to your Cloudflare account using Wrangler:
    ```bash
    npx wrangler deploy
    ```
3.  Configure the tracker in `health/tracker.ts` and add your own LLM API keys as Worker secrets if you want AI insights.

## How It Works
You operate the entire service. The code runs on a single Cloudflare Worker. All your log entries and trend memory are stored in your Cloudflare KV namespace. AI inference is an optional add-on; the system works as a simple private log without it.

### Features
*   **Fork-first Deployment:** You control the instance and its data.
*   **Optional AI:** Add your own keys for OpenAI, DeepSeek, or local models. Works without any AI.
*   **Trend Memory:** Correlates entries (e.g., sleep quality and caffeine) over weeks.
*   **Private by Default:** Your data stays in your KV store. Optional AI calls use PII redaction.
*   **Full Data Export:** All logs are structured JSON.
*   **Zero Dependencies:** No npm packages; nothing is fetched at runtime.
*   **MIT Licensed:** Use, modify, or redistribute freely.

### One Limitation
Your log history is stored in a single KV entry for context. Cloudflare KV has a 25MB maximum value size, which limits the total history you can store before needing to archive or prune old data.

<div style="text-align:center;padding:16px;color:#64748b;font-size:.8rem"><a href="https://the-fleet.casey-digennaro.workers.dev" style="color:#64748b">The Fleet</a> &middot; <a href="https://cocapn.ai" style="color:#64748b">Cocapn</a></div>

---

<i>Built with [Cocapn](https://github.com/Lucineer/cocapn-ai) — the open-source agent runtime.</i>
<i>Part of the [Lucineer fleet](https://github.com/Lucineer)</i>

