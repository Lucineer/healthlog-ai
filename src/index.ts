// healthlog-ai — Cloudflare Worker
// API: /api/chat (SSE), /api/health/log, /api/health/history, /api/reminders, /api/insights

import { SymptomTracker, VitalSigns, MedicationReminder, HealthInsights } from "./health/tracker";

export interface Env {
  HEALTH_KV: KVNamespace;
  DEEPSEEK_API_URL: string;
  DEEPSEEK_API_KEY: string;
}

const USER_ID = "default_user";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

async function handleChat(body: { messages: { role: string; content: string }[] }, env: Env): Promise<Response> {
  const systemPrompt = {
    role: "system",
    content: `You are HealthLog AI, a knowledgeable health and wellness assistant. You help users understand their symptoms, medications, vitals, and general health questions. Always remind users you are not a doctor and they should consult healthcare professionals for medical decisions. Be concise, empathetic, and evidence-based.`,
  };

  const messages = [systemPrompt, ...body.messages];

  const response = await fetch(env.DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({ model: "deepseek-chat", messages, stream: true }),
  });

  if (!response.ok) {
    return errorResponse("Failed to connect to AI service", 502);
  }

  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...corsHeaders(),
    },
  });
}

async function handleHealthLog(body: Record<string, unknown>, env: Env): Promise<Response> {
  const kv = env.HEALTH_KV;
  const type = body.type as string;

  if (type === "symptom") {
    const tracker = new SymptomTracker(kv);
    const entry = await tracker.log({
      userId: USER_ID,
      symptom: body.symptom as string,
      severity: body.severity as 1 | 2 | 3 | 4 | 5,
      notes: (body.notes as string) || "",
      tags: (body.tags as string[]) || [],
    });
    return jsonResponse({ success: true, entry });
  }

  if (type === "vital") {
    const vitals = new VitalSigns(kv);
    const entry = await vitals.log({
      userId: USER_ID,
      type: body.vitalType as "blood_pressure" | "heart_rate" | "temperature" | "oxygen" | "weight" | "glucose",
      value: body.value as number,
      unit: body.unit as string,
      systolic: body.systolic as number | undefined,
      diastolic: body.diastolic as number | undefined,
      notes: body.notes as string | undefined,
    });
    return jsonResponse({ success: true, entry });
  }

  if (type === "medication") {
    const meds = new MedicationReminder(kv);
    const entry = await meds.addMedication({
      userId: USER_ID,
      name: body.name as string,
      dosage: body.dosage as string,
      frequency: body.frequency as string,
      times: body.times as string[],
      startDate: body.startDate as string,
      endDate: body.endDate as string | undefined,
      active: true,
      notes: body.notes as string | undefined,
    });
    return jsonResponse({ success: true, entry });
  }

  return errorResponse("Invalid log type. Use: symptom, vital, or medication");
}

async function handleHealthHistory(url: URL, env: Env): Promise<Response> {
  const kv = env.HEALTH_KV;
  const category = url.searchParams.get("category") || "all";
  const limit = parseInt(url.searchParams.get("limit") || "50");

  const result: Record<string, unknown[]> = {};

  if (category === "all" || category === "symptoms") {
    const tracker = new SymptomTracker(kv);
    result.symptoms = await tracker.getHistory(USER_ID, limit);
  }
  if (category === "all" || category === "vitals") {
    const vitals = new VitalSigns(kv);
    result.vitals = await vitals.getHistory(USER_ID, undefined, limit);
  }
  if (category === "all" || category === "medications") {
    const meds = new MedicationReminder(kv);
    result.medications = await meds.getMedications(USER_ID);
  }

  return jsonResponse(result);
}

async function handleReminders(request: Request, env: Env): Promise<Response> {
  const kv = env.HEALTH_KV;
  const meds = new MedicationReminder(kv);

  if (request.method === "GET") {
    const url = new URL(request.url);
    const date = url.searchParams.get("date") || new Date().toISOString().split("T")[0];
    const reminders = await meds.getReminders(USER_ID, date);
    const medications = await meds.getMedications(USER_ID);
    return jsonResponse({ reminders, medications });
  }

  if (request.method === "POST") {
    const body = (await request.json()) as Record<string, unknown>;
    const action = body.action as string;

    if (action === "mark_taken") {
      const reminder = await meds.markTaken(
        USER_ID,
        body.medicationId as string,
        body.date as string,
        body.time as string
      );
      return jsonResponse({ success: true, reminder });
    }

    if (action === "deactivate") {
      await meds.deactivateMedication(USER_ID, body.medicationId as string);
      return jsonResponse({ success: true });
    }

    return errorResponse("Invalid action. Use: mark_taken or deactivate");
  }

  return errorResponse("Method not allowed", 405);
}

async function handleInsights(env: Env, regenerate = false): Promise<Response> {
  const kv = env.HEALTH_KV;
  const tracker = new SymptomTracker(kv);
  const vitals = new VitalSigns(kv);
  const insights = new HealthInsights(kv, tracker, vitals);

  if (regenerate) {
    const generated = await insights.generateInsights(USER_ID);
    return jsonResponse({ insights: generated, generated: true });
  }

  const existing = await insights.getInsights(USER_ID);
  return jsonResponse({ insights: existing, generated: false });
}

// ── HTML serving ────────────────────────────────────────────────

async function serveApp(env: Env): Promise<Response> {
  const html = await env.HEALTH_KV.get("static:app.html");
  if (html) {
    return new Response(html, { headers: { "Content-Type": "text/html" } });
  }
  // Fallback: read from public directory at deploy time is embedded via wrangler
  return new Response("HealthLog AI — Please upload app.html to KV with key 'static:app.html'", {
    status: 503,
    headers: { "Content-Type": "text/plain" },
  });
}

// ── Router ──────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // Serve UI at root
    if (path === "/" || path === "/index.html") {
      return serveApp(env);
    }

    // API routes
    if (path === "/api/chat" && request.method === "POST") {
      const body = (await request.json()) as { messages: { role: string; content: string }[] };
      return handleChat(body, env);
    }

    if (path === "/api/health/log" && request.method === "POST") {
      const body = (await request.json()) as Record<string, unknown>;
      return handleHealthLog(body, env);
    }

    if (path === "/api/health/history" && request.method === "GET") {
      return handleHealthHistory(url, env);
    }

    if (path === "/api/reminders") {
      return handleReminders(request, env);
    }

    if (path === "/api/insights" && request.method === "GET") {
      const regenerate = url.searchParams.get("regenerate") === "true";
      return handleInsights(env, regenerate);
    }

    return errorResponse("Not found", 404);
  },
};
