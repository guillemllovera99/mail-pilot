import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { SuggestionCard } from "@/components/suggestion-card"
import Link from "next/link"

export default async function ReviewPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const suggestions = await prisma.emailSuggestion.findMany({
    where: {
      userId: session.user.id,
      status: "PENDING",
      confidence: { gt: 0 },
    },
    orderBy: [
      { suggestedPriority: "asc" },
      { confidence: "desc" },
    ],
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

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-10">
      <div className="w-full max-w-xl mx-auto space-y-5">

        <div>
          <Link href="/dashboard" className="text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1 mb-3">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Dashboard
          </Link>
          <h1 className="text-xl font-bold text-white">Review suggestions</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            AI found {suggestions.length} possible action item{suggestions.length !== 1 ? "s" : ""} in your inbox
          </p>
        </div>

        {unprocessed > 0 && (
          <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-xl px-4 py-3 text-sm text-yellow-400">
            {unprocessed} email{unprocessed !== 1 ? "s" : ""} still being processed — check back soon.
          </div>
        )}

        {serialised.length === 0 && unprocessed === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-10 text-center">
            <p className="text-gray-500 text-sm">No suggestions to review right now.</p>
            <p className="text-gray-700 text-xs mt-1">Sync your inbox and run AI extraction to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {serialised.map(s => (
              <SuggestionCard key={s.id} s={s as any} />
            ))}
          </div>
        )}

        {suggestions.length > 0 && (
          <p className="text-center text-xs text-gray-700 pt-2">
            Approved items become tasks · dismissed items are hidden
          </p>
        )}
      </div>
    </div>
  )
}
