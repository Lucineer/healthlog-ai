<p align="center">
  <img src="https://raw.githubusercontent.com/Lucineer/capitaine/master/docs/capitaine-logo.jpg" alt="Capitaine" width="120">
</p>

<h1 align="center">healthlog-ai</h1>

<p align="center">A private, self-hosted health tracking agent.</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#features">Features</a> ·
  <a href="#why-this-exists">Why</a> ·
  <a href="#limitations">Limitations</a> ·
  <a href="https://healthlog-ai.casey-digennaro.workers.dev">Live Demo</a> ·
  <a href="https://github.com/Lucineer/healthlog-ai/issues">Issues</a>
</p>

---

Most health apps are built for advertisers, not for you. They ask the same questions, forget your history, and lock your data in their cloud.

healthlog-ai is a forkable agent that runs on infrastructure you control. It logs workouts, meals, sleep, and mood. Without an LLM, it works as a silent tracker. With one, it can spot patterns over time.

You fork it once. You run it. It stays yours.

Powered by [Capitaine](https://github.com/Lucineer/capitaine) · Cocapn Fleet

---

## Why this exists

This agent was built to run entirely on your infrastructure, with zero shared state. No central server, no hidden analytics.

All logic lives in this repository. When you fork it, you get the entire application. You can modify it or turn it off. Your data is stored in your Cloudflare account and never leaves.

It is part of the Cocapn Fleet: an open network of independent agents that only answer to their owners.

## What makes this different

1.  **Fork-first deployment.** There is no account system. You deploy to your own Cloudflare Worker. No one else can access your data.
2.  **The repository is the agent.** Every commit is a potential upgrade. The agent can even propose improvements to itself.
3.  **No data lock-in.** Logs are stored as structured JSON. Export them anytime.
4.  **Model optional.** Use OpenAI, DeepSeek, a local model, or no LLM at all.

## Quick Start

Fork this repository, then run:

```bash
gh repo fork Lucineer/healthlog-ai --clone
cd healthlog-ai
npx wrangler deploy
```

Set API keys as Cloudflare Secrets if using an LLM. Your agent is online.

## Features

*   Operates as a plain tracker or with optional AI insights
*   Zero API keys in source code; uses Cloudflare Secrets
*   Compatible with major LLM providers and local models
*   Session memory builds context over weeks
*   Basic PII detection before LLM calls
*   Built-in rate limiting and health checks
*   Single file worker, no runtime dependencies, cold start under 10ms

## Limitations

Without an LLM, the agent provides only structured logging and basic data visualization. AI-powered insights require a configured model.

## Architecture

This is a production agent, not a framework.

```
src/
  worker.ts      # Serves UI, handles requests, manages fleet protocol
lib/
  byok.ts        # Multi-model routing
  memory.ts      # Context window management
  sanitize.ts    # Data cleaning and PII handling
```

The entire application runs in a single Cloudflare Worker.

---

<div align="center">
  <p>
    Part of the <a href="https://the-fleet.casey-digennaro.workers.dev">Cocapn Fleet</a> · 
    <a href="https://cocapn.ai">Cocapn</a> · 
    Attribution: Superinstance & Lucineer (DiGennaro et al.)
  </p>
</div>