import { prisma } from "@/lib/db"
import { extractActionItem } from "@/lib/gemini"

const BATCH_SIZE = 20  // max per run to stay within free-tier limits

export interface ExtractionSummary {
  processed: number
  skipped: number
  errors: number
}

export async function runAiExtraction(userId?: string): Promise<ExtractionSummary> {
  // confidence = 0 means not yet AI-processed (default value in schema)
  const where = {
    status: "PENDING" as const,
    confidence: 0,
    ...(userId ? { userId } : {}),
  }

  const suggestions = await prisma.emailSuggestion.findMany({
    where,
    take: BATCH_SIZE,
    orderBy: { createdAt: "desc" },
  })

  let processed = 0
  let errors = 0

  for (const s of suggestions) {
    try {
      const result = await extractActionItem(
        s.emailSubject ?? "(no subject)",
        s.emailFrom ?? "",
        s.suggestedDescription ?? ""
      )

      let dueDateParsed: Date | null = null
      if (result.dueDateIso) {
        const d = new Date(result.dueDateIso)
        if (!isNaN(d.getTime())) dueDateParsed = d
      }

      await prisma.emailSuggestion.update({
        where: { id: s.id },
        data: {
          suggestedTitle: result.title,
          suggestedPriority: result.priority,
          suggestedDueDate: dueDateParsed,
          suggestedTags: result.tags,
          suggestedAmount: result.amount,
          suggestedAssignee: result.assignee,
          confidence: result.confidence,
          // Auto-dismiss newsletters/notifications with very low confidence
          status:
            !result.isActionable && result.confidence < 0.15
              ? "DISMISSED"
              : "PENDING",
        },
      })

      processed++
      console.log(
        `[ai-extract] id=${s.id} title="${result.title}" priority=${result.priority} confidence=${result.confidence.toFixed(2)}`
      )
    } catch (err) {
      errors++
      console.error(`[ai-extract] error id=${s.id}:`, err)
      // Mark with tiny non-zero confidence so we don't retry in a tight loop
      await prisma.emailSuggestion.update({
        where: { id: s.id },
        data: { confidence: 0.01 },
      }).catch(() => {})
    }
  }

  return { processed, skipped: 0, errors }
}
