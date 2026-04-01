# HealthLog AI

AI-powered health and wellness tracking application built on Cloudflare Workers.

## Features

- **Symptom Tracking** — Log symptoms with severity, notes, and tags. Automatic pattern detection for recurring symptoms.
- **Vital Signs** — Record heart rate, blood pressure, temperature, SpO2, weight, and blood glucose.
- **Medication Reminders** — Add medications with schedules, track daily adherence, mark doses as taken.
- **Health Insights** — AI-generated analysis: symptom patterns, vital sign warnings, medication adherence suggestions.
- **AI Chat** — DeepSeek-powered health assistant via SSE streaming.

## Architecture

```
healthlog-ai/
├── src/
│   ├── index.ts              # Cloudflare Worker — API router
│   └── health/
│       └── tracker.ts        # SymptomTracker, VitalSigns, MedicationReminder, HealthInsights
├── public/
│   └── app.html              # Medical UI (teal #0D9488, white, soft gray)
├── wrangler.toml
├── tsconfig.json
└── package.json
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | SSE streaming chat with DeepSeek |
| POST | `/api/health/log` | Log symptoms, vitals, or medications |
| GET | `/api/health/history` | Retrieve health history |
| GET/POST | `/api/reminders` | Get reminders or mark medications taken |
| GET | `/api/insights` | Get or regenerate health insights |

## Setup

```bash
npm install
export DEEPSEEK_API_KEY=your_key_here
npx wrangler dev
```

## Deployment

```bash
npx wrangler deploy
```

Upload the UI to KV:
```bash
npx wrangler kv:key put --binding=HEALTH_KV "static:app.html" --path=public/app.html
```

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Storage**: Cloudflare KV
- **AI**: DeepSeek (SSE streaming)
- **UI**: Vanilla HTML/CSS/JS — no framework dependencies
