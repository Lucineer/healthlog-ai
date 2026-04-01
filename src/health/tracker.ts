// healthlog-ai — Health Tracking Engine
// SymptomTracker, VitalSigns, MedicationReminder, HealthInsights

export interface SymptomEntry {
  id: string;
  userId: string;
  symptom: string;
  severity: 1 | 2 | 3 | 4 | 5;
  notes: string;
  timestamp: string;
  tags: string[];
}

export interface VitalEntry {
  id: string;
  userId: string;
  type: "blood_pressure" | "heart_rate" | "temperature" | "oxygen" | "weight" | "glucose";
  value: number;
  unit: string;
  systolic?: number;
  diastolic?: number;
  timestamp: string;
  notes?: string;
}

export interface MedicationEntry {
  id: string;
  userId: string;
  name: string;
  dosage: string;
  frequency: string;
  times: string[];
  startDate: string;
  endDate?: string;
  active: boolean;
  notes?: string;
}

export interface ReminderEntry {
  id: string;
  userId: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  time: string;
  taken: boolean;
  timestamp: string;
}

export interface HealthInsight {
  id: string;
  userId: string;
  type: "pattern" | "warning" | "trend" | "suggestion";
  title: string;
  description: string;
  confidence: number;
  relatedEntries: string[];
  timestamp: string;
}

// ── SymptomTracker ──────────────────────────────────────────────

export class SymptomTracker {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  async log(entry: Omit<SymptomEntry, "id" | "timestamp">): Promise<SymptomEntry> {
    const symptom: SymptomEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    const key = `symptoms:${entry.userId}:${symptom.id}`;
    await this.kv.put(key, JSON.stringify(symptom));
    await this.appendToIndex(entry.userId, "symptoms", symptom.id);
    return symptom;
  }

  async getHistory(userId: string, limit = 50): Promise<SymptomEntry[]> {
    const ids = await this.getIndex(userId, "symptoms");
    const entries: SymptomEntry[] = [];
    for (const id of ids.slice(-limit)) {
      const raw = await this.kv.get(`symptoms:${userId}:${id}`);
      if (raw) entries.push(JSON.parse(raw));
    }
    return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async detectPatterns(userId: string): Promise<HealthInsight[]> {
    const history = await this.getHistory(userId, 100);
    if (history.length < 3) return [];

    const insights: HealthInsight[] = [];
    const symptomFreq = new Map<string, number>();
    const sevMap = new Map<string, number[]>();

    for (const entry of history) {
      symptomFreq.set(entry.symptom, (symptomFreq.get(entry.symptom) || 0) + 1);
      if (!sevMap.has(entry.symptom)) sevMap.set(entry.symptom, []);
      sevMap.get(entry.symptom)!.push(entry.severity);
    }

    for (const [symptom, count] of symptomFreq) {
      if (count >= 3) {
        const sevs = sevMap.get(symptom) || [];
        const avgSev = sevs.reduce((a, b) => a + b, 0) / sevs.length;
        const trending = sevs.length >= 3 &&
          sevs.slice(-3).every((s, i) => i === 0 || s >= sevs.slice(-3)[i - 1]);

        insights.push({
          id: crypto.randomUUID(),
          userId,
          type: trending ? "warning" : "pattern",
          title: trending ? `Increasing severity: ${symptom}` : `Recurring symptom: ${symptom}`,
          description: `"${symptom}" logged ${count} times. Average severity: ${avgSev.toFixed(1)}/5.${trending ? " Severity is trending upward — consider consulting your provider." : ""}`,
          confidence: Math.min(0.95, 0.5 + count * 0.05),
          relatedEntries: history.filter(e => e.symptom === symptom).map(e => e.id),
          timestamp: new Date().toISOString(),
        });
      }
    }
    return insights;
  }

  private async appendToIndex(userId: string, type: string, id: string): Promise<void> {
    const key = `index:${userId}:${type}`;
    const existing = await this.kv.get(key);
    const ids: string[] = existing ? JSON.parse(existing) : [];
    ids.push(id);
    await this.kv.put(key, JSON.stringify(ids));
  }

  private async getIndex(userId: string, type: string): Promise<string[]> {
    const raw = await this.kv.get(`index:${userId}:${type}`);
    return raw ? JSON.parse(raw) : [];
  }
}

// ── VitalSigns ──────────────────────────────────────────────────

export class VitalSigns {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  async log(entry: Omit<VitalEntry, "id" | "timestamp">): Promise<VitalEntry> {
    const vital: VitalEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    const key = `vitals:${entry.userId}:${vital.id}`;
    await this.kv.put(key, JSON.stringify(vital));
    await this.appendToIndex(entry.userId, "vitals", vital.id);
    return vital;
  }

  async getHistory(userId: string, type?: VitalEntry["type"], limit = 50): Promise<VitalEntry[]> {
    const ids = await this.getIndex(userId, "vitals");
    const entries: VitalEntry[] = [];
    for (const id of ids.slice(-limit * 2)) {
      const raw = await this.kv.get(`vitals:${userId}:${id}`);
      if (raw) {
        const parsed: VitalEntry = JSON.parse(raw);
        if (!type || parsed.type === type) entries.push(parsed);
      }
    }
    return entries
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async getLatest(userId: string): Promise<Record<string, VitalEntry | null>> {
    const types: VitalEntry["type"][] = ["blood_pressure", "heart_rate", "temperature", "oxygen", "weight", "glucose"];
    const result: Record<string, VitalEntry | null> = {};
    for (const t of types) {
      const history = await this.getHistory(userId, t, 1);
      result[t] = history[0] || null;
    }
    return result;
  }

  private async appendToIndex(userId: string, type: string, id: string): Promise<void> {
    const key = `index:${userId}:${type}`;
    const existing = await this.kv.get(key);
    const ids: string[] = existing ? JSON.parse(existing) : [];
    ids.push(id);
    await this.kv.put(key, JSON.stringify(ids));
  }

  private async getIndex(userId: string, type: string): Promise<string[]> {
    const raw = await this.kv.get(`index:${userId}:${type}`);
    return raw ? JSON.parse(raw) : [];
  }
}

// ── MedicationReminder ──────────────────────────────────────────

export class MedicationReminder {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  async addMedication(med: Omit<MedicationEntry, "id">): Promise<MedicationEntry> {
    const entry: MedicationEntry = { ...med, id: crypto.randomUUID() };
    const key = `meds:${med.userId}:${entry.id}`;
    await this.kv.put(key, JSON.stringify(entry));
    await this.appendToIndex(med.userId, "meds", entry.id);
    return entry;
  }

  async getMedications(userId: string, activeOnly = true): Promise<MedicationEntry[]> {
    const ids = await this.getIndex(userId, "meds");
    const entries: MedicationEntry[] = [];
    for (const id of ids) {
      const raw = await this.kv.get(`meds:${userId}:${id}`);
      if (raw) {
        const parsed: MedicationEntry = JSON.parse(raw);
        if (!activeOnly || parsed.active) entries.push(parsed);
      }
    }
    return entries;
  }

  async getReminders(userId: string, date?: string): Promise<ReminderEntry[]> {
    const meds = await this.getMedications(userId);
    const targetDate = date || new Date().toISOString().split("T")[0];
    const reminders: ReminderEntry[] = [];

    for (const med of meds) {
      for (const time of med.times) {
        const key = `reminder:${userId}:${med.id}:${targetDate}:${time}`;
        const existing = await this.kv.get(key);
        reminders.push(existing
          ? JSON.parse(existing)
          : {
              id: crypto.randomUUID(),
              userId,
              medicationId: med.id,
              medicationName: med.name,
              dosage: med.dosage,
              time,
              taken: false,
              timestamp: `${targetDate}T${time}:00.000Z`,
            }
        );
      }
    }
    return reminders.sort((a, b) => a.time.localeCompare(b.time));
  }

  async markTaken(userId: string, medicationId: string, date: string, time: string): Promise<ReminderEntry> {
    const meds = await this.getMedications(userId);
    const med = meds.find(m => m.id === medicationId);
    if (!med) throw new Error("Medication not found");

    const reminder: ReminderEntry = {
      id: crypto.randomUUID(),
      userId,
      medicationId,
      medicationName: med.name,
      dosage: med.dosage,
      time,
      taken: true,
      timestamp: new Date().toISOString(),
    };
    const key = `reminder:${userId}:${medicationId}:${date}:${time}`;
    await this.kv.put(key, JSON.stringify(reminder));
    return reminder;
  }

  async deactivateMedication(userId: string, medicationId: string): Promise<void> {
    const raw = await this.kv.get(`meds:${userId}:${medicationId}`);
    if (!raw) throw new Error("Medication not found");
    const med: MedicationEntry = JSON.parse(raw);
    med.active = false;
    await this.kv.put(`meds:${userId}:${medicationId}`, JSON.stringify(med));
  }

  private async appendToIndex(userId: string, type: string, id: string): Promise<void> {
    const key = `index:${userId}:${type}`;
    const existing = await this.kv.get(key);
    const ids: string[] = existing ? JSON.parse(existing) : [];
    ids.push(id);
    await this.kv.put(key, JSON.stringify(ids));
  }

  private async getIndex(userId: string, type: string): Promise<string[]> {
    const raw = await this.kv.get(`index:${userId}:${type}`);
    return raw ? JSON.parse(raw) : [];
  }
}

// ── HealthInsights ──────────────────────────────────────────────

export class HealthInsights {
  private kv: KVNamespace;
  private symptomTracker: SymptomTracker;
  private vitalSigns: VitalSigns;

  constructor(kv: KVNamespace, symptomTracker: SymptomTracker, vitalSigns: VitalSigns) {
    this.kv = kv;
    this.symptomTracker = symptomTracker;
    this.vitalSigns = vitalSigns;
  }

  async generateInsights(userId: string): Promise<HealthInsight[]> {
    const insights: HealthInsight[] = [];

    // Symptom patterns
    const symptomInsights = await this.symptomTracker.detectPatterns(userId);
    insights.push(...symptomInsights);

    // Vital sign analysis
    const vitalInsights = await this.analyzeVitals(userId);
    insights.push(...vitalInsights);

    // Medication adherence suggestions
    const adherenceInsight = await this.analyzeAdherence(userId);
    if (adherenceInsight) insights.push(adherenceInsight);

    // Store insights
    for (const insight of insights) {
      const key = `insights:${userId}:${insight.id}`;
      await this.kv.put(key, JSON.stringify(insight));
      await this.appendToIndex(userId, "insights", insight.id);
    }

    return insights;
  }

  async getInsights(userId: string, limit = 20): Promise<HealthInsight[]> {
    const ids = await this.getIndex(userId, "insights");
    const entries: HealthInsight[] = [];
    for (const id of ids.slice(-limit)) {
      const raw = await this.kv.get(`insights:${userId}:${id}`);
      if (raw) entries.push(JSON.parse(raw));
    }
    return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  private async analyzeVitals(userId: string): Promise<HealthInsight[]> {
    const insights: HealthInsight[] = [];
    const latest = await this.vitalSigns.getLatest(userId);

    if (latest.heart_rate && latest.heart_rate.value > 100) {
      insights.push({
        id: crypto.randomUUID(),
        userId,
        type: "warning",
        title: "Elevated Heart Rate",
        description: `Resting heart rate of ${latest.heart_rate.value} bpm is above the normal range (60-100 bpm). Consider consulting your healthcare provider.`,
        confidence: 0.85,
        relatedEntries: [latest.heart_rate.id],
        timestamp: new Date().toISOString(),
      });
    }

    if (latest.temperature && latest.temperature.value > 99.5) {
      insights.push({
        id: crypto.randomUUID(),
        userId,
        type: "warning",
        title: "Elevated Temperature",
        description: `Temperature of ${latest.temperature.value}°F is above normal (98.6°F). Monitor for additional symptoms.`,
        confidence: 0.80,
        relatedEntries: [latest.temperature.id],
        timestamp: new Date().toISOString(),
      });
    }

    if (latest.oxygen && latest.oxygen.value < 95) {
      insights.push({
        id: crypto.randomUUID(),
        userId,
        type: "warning",
        title: "Low Oxygen Saturation",
        description: `SpO2 of ${latest.oxygen.value}% is below normal (95-100%). Seek medical attention if this persists.`,
        confidence: 0.90,
        relatedEntries: [latest.oxygen.id],
        timestamp: new Date().toISOString(),
      });
    }

    if (latest.glucose && latest.glucose.value > 140) {
      insights.push({
        id: crypto.randomUUID(),
        userId,
        type: "warning",
        title: "Elevated Blood Glucose",
        description: `Blood glucose of ${latest.glucose.value} mg/dL is above normal fasting range (70-100 mg/dL). Consider discussing with your provider.`,
        confidence: 0.80,
        relatedEntries: [latest.glucose.id],
        timestamp: new Date().toISOString(),
      });
    }

    return insights;
  }

  private async analyzeAdherence(userId: string): Promise<HealthInsight | null> {
    const medReminders = new MedicationReminder(this.kv);
    const today = new Date().toISOString().split("T")[0];
    const reminders = await medReminders.getReminders(userId, today);
    if (reminders.length === 0) return null;

    const taken = reminders.filter(r => r.taken).length;
    const total = reminders.length;
    const rate = taken / total;

    if (rate < 0.8) {
      return {
        id: crypto.randomUUID(),
        userId,
        type: "suggestion",
        title: "Medication Adherence",
        description: `You've taken ${taken}/${total} scheduled doses today (${(rate * 100).toFixed(0)}%). Consistent medication adherence is important for treatment effectiveness.`,
        confidence: 0.95,
        relatedEntries: reminders.map(r => r.id),
        timestamp: new Date().toISOString(),
      };
    }
    return null;
  }

  private async appendToIndex(userId: string, type: string, id: string): Promise<void> {
    const key = `index:${userId}:${type}`;
    const existing = await this.kv.get(key);
    const ids: string[] = existing ? JSON.parse(existing) : [];
    ids.push(id);
    await this.kv.put(key, JSON.stringify(ids));
  }

  private async getIndex(userId: string, type: string): Promise<string[]> {
    const raw = await this.kv.get(`index:${userId}:${type}`);
    return raw ? JSON.parse(raw) : [];
  }
}
