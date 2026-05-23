const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
const MODEL = "gemini-2.0-flash"

export interface ExtractionResult {
  isActionable: boolean
  title: string
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW"
  dueDateIso: string | null   // ISO 8601 or null
  tags: string[]
  amount: string | null
  assignee: string | null
  confidence: number          // 0.0 – 1.0
}

function buildPrompt(subject: string, from: string, bodyPreview: string): string {
  const today = new Date().toISOString().split("T")[0]
  return `You analyze business emails and extract action items for a CFO.
Return ONLY valid JSON matching the schema below. No markdown fences, no extra text.

Today's date: ${today}

Email subject: ${subject}
From: ${from}
Body preview: ${bodyPreview}

Extract any action item this CFO must act on. Return JSON:
{
  "isActionable": <true if the CFO needs to do something, false for newsletters/notifications/FYI>,
  "title": "<concise imperative task title, max 80 chars, e.g. 'Review Q3 invoice from Acme'>",
  "priority": "<URGENT|HIGH|MEDIUM|LOW based on urgency/financial impact>",
  "dueDateIso": "<ISO 8601 date string if a deadline is mentioned, otherwise null>",
  "tags": ["<relevant tag>", ...],
  "amount": "<monetary amount if mentioned, e.g. '$12,500', otherwise null>",
  "assignee": "<name or email of person to coordinate with (not the sender), otherwise null>",
  "confidence": <0.0–1.0, how confident this is a real CFO action item>
}

Priority guidelines:
- URGENT: legal deadlines, overdue payments, compliance, security
- HIGH: payments >$10k, contracts, approvals needed this week
- MEDIUM: routine approvals, invoices <$10k, meetings
- LOW: FYI items, newsletters, automated notifications

If not actionable, still return valid JSON with isActionable=false and confidence<=0.15.`
}

export async function extractActionItem(
  subject: string,
  from: string,
  bodyPreview: string
): Promise<ExtractionResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not set")

  const prompt = buildPrompt(subject, from ?? "", bodyPreview ?? "")

  const res = await fetch(
    `${GEMINI_BASE}/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
          maxOutputTokens: 512,
        },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini ${res.status}: ${err}`)
  }

  const data = await res.json()
  const raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""

  let parsed: ExtractionResult
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Gemini returned non-JSON: ${raw.slice(0, 200)}`)
  }

  return {
    isActionable: Boolean(parsed.isActionable),
    title: String(parsed.title ?? subject).slice(0, 120),
    priority: (["URGENT", "HIGH", "MEDIUM", "LOW"].includes(parsed.priority)
      ? parsed.priority
      : "MEDIUM") as ExtractionResult["priority"],
    dueDateIso: parsed.dueDateIso ?? null,
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6) : [],
    amount: parsed.amount ?? null,
    assignee: parsed.assignee ?? null,
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.1)),
  }
}
