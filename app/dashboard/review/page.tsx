export const dynamic = "force-dynamic"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { SuggestionCard } from "@/components/suggestion-card"
import Link from "next/link"

const CATEGORY_ORDER = ["FINANCE", "LEGAL", "BOARD", "HR", "INVESTORS", "OPERATIONS", "PERSONAL", "OTHER"]
const CATEGORY_LABELS: Record<string, string> = {
  FINANCE: "Finance", LEGAL: "Legal", BOARD: "Board", HR: "HR",
  INVESTORS: "Investors", OPERATIONS: "Ops", PERSONAL: "Personal", OTHER: "Other",
}
const CATEGORY_COLOURS: Record<string, string> = {
  FINANCE: "text-green-400 border-green-900 bg-green-900/20",
  LEGAL: "text-purple-400 border-purple-900 bg-purple-900/20",
  BOARD: "text-blue-400 border-blue-900 bg-blue-900/20",
  HR: "text-pink-400 border-pink-900 bg-pink-900/20",
  INVESTORS: "text-yellow-400 border-yellow-900 bg-yellow-900/20",
  OPERATIONS: "text-orange-400 border-orange-900 bg-orange-900/20",
  PERSONAL: "text-gray-400 border-gray-800 bg-gray-800/40",
  OTHER: "text-gray-500 border-gray-800 bg-gray-800/20",
}

export default async function ReviewPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const suggestions = await prisma.emailSuggestion.findMany({
    where: {
      userId: session.user.id,
      status: "PENDING",
      confidence: { gt: 0 },
    },
    orderBy: [{ suggestedPriority: "asc" }, { confidence: "desc" }],
  })

  const unprocessed = await prisma.emailSuggestion.count({
    where: { userId: session.user.id, status: "PENDING", confidence: 0 },
  })

  const serialised = suggestions.map(s => ({
    ...s,
    emailReceivedAt: s.emailReceivedAt?.toISOString() ?? null,
    suggestedDueDate: s.suggestedDueDate?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    reviewedAt: s.reviewedAt?.toISOString() ?? null,
  }))

  // Group by category
  const grouped: Record<string, typeof serialised> = {}
  for (const s of serialised) {
    const cat = s.suggestedCategory ?? "OTHER"
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(s)
  }
  const categories = CATEGORY_ORDER.filter(c => grouped[c]?.length)

  // Urgent + High across all categories (pinned at top)
  const urgent = serialised.filter(s =>
    s.suggestedPriority === "URGENT" || s.suggestedPriority === "HIGH"
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Review</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {serialised.length} action item{serialised.length !== 1 ? "s" : ""} found across {categories.length} categor{categories.length !== 1 ? "ies" : "y"}
        </p>
      </div>

      {/* Processing banner */}
      {unprocessed > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-xl px-4 py-3 text-sm text-yellow-400">
          {unprocessed} email{unprocessed !== 1 ? "s" : ""} still being processed — check back soon.
        </div>
      )}

      {/* Empty state */}
      {serialised.length === 0 && unprocessed === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-green-900/40 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-white font-semibold">All clear!</p>
          <p className="text-gray-600 text-xs mt-1">No suggestions to review right now.</p>
        </div>
      )}

      {/* Urgent / High pinned section */}
      {urgent.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">
              🔴 Needs attention · {urgent.length}
            </span>
          </div>
          {urgent.map(s => <SuggestionCard key={s.id} s={s as any} />)}
        </div>
      )}

      {/* Category groups */}
      {categories.map(cat => {
        const items = grouped[cat]
        const colour = CATEGORY_COLOURS[cat] ?? CATEGORY_COLOURS.OTHER
        // Skip if all are already shown in urgent section (don't double-show)
        const nonUrgent = items.filter(s => s.suggestedPriority !== "URGENT" && s.suggestedPriority !== "HIGH")
        if (nonUrgent.length === 0) return null
        return (
          <div key={cat} className="space-y-3">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold ${colour}`}>
              {CATEGORY_LABELS[cat]} · {items.length}
            </div>
            {nonUrgent.map(s => <SuggestionCard key={s.id} s={s as any} />)}
          </div>
        )
      })}

      {serialised.length > 0 && (
        <p className="text-center text-xs text-gray-700 pt-2">
          Approved items become tasks · dismissed items are hidden
        </p>
      )}
    </div>
  )
}
