export const dynamic = "force-dynamic"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"

const CATEGORY_COLOURS: Record<string, string> = {
  FINANCE: "text-green-400 border-green-800",
  LEGAL: "text-purple-400 border-purple-800",
  BOARD: "text-blue-400 border-blue-800",
  HR: "text-pink-400 border-pink-800",
  INVESTORS: "text-yellow-400 border-yellow-800",
  OPERATIONS: "text-orange-400 border-orange-800",
  PERSONAL: "text-gray-400 border-gray-700",
  OTHER: "text-gray-500 border-gray-700",
}
const CATEGORY_LABELS: Record<string, string> = {
  FINANCE: "Finance", LEGAL: "Legal", BOARD: "Board", HR: "HR",
  INVESTORS: "Investors", OPERATIONS: "Ops", PERSONAL: "Personal", OTHER: "Other",
}
const PRIORITY_DOT: Record<string, string> = {
  URGENT: "bg-red-500", HIGH: "bg-orange-500", MEDIUM: "bg-yellow-500", LOW: "bg-gray-600",
}
const PRIORITY_COLOUR: Record<string, string> = {
  URGENT: "text-red-400", HIGH: "text-orange-400", MEDIUM: "text-yellow-400", LOW: "text-gray-500",
}

function formatDate(date: Date | null) {
  if (!date) return ""
  const diff = Math.floor((Date.now() - date.getTime()) / 86400000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return `${diff}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: diff > 365 ? "numeric" : undefined })
}

function initials(email: string): string {
  const name = email.split("@")[0].replace(/[._-]/g, " ")
  const parts = name.split(" ").filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export default async function ContactTimelinePage({
  params,
}: {
  params: { email: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login")

  const emailDecoded = decodeURIComponent(params.email)

  // All emails received from this sender (EmailSuggestion = every synced email)
  const allEmails = await prisma.emailSuggestion.findMany({
    where: {
      userId: session.user.id,
      emailFrom: { contains: emailDecoded, mode: "insensitive" },
    },
    orderBy: { emailReceivedAt: "desc" },
    select: {
      id: true,
      emailSubject: true,
      emailFrom: true,
      emailReceivedAt: true,
      suggestedTitle: true,
      suggestedPriority: true,
      suggestedCategory: true,
      suggestedDescription: true,
      confidence: true,
      status: true,
    },
  })

  if (allEmails.length === 0) notFound()

  // All tasks from this sender
  const tasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      emailFrom: { contains: emailDecoded, mode: "insensitive" },
      status: { not: "CANCELLED" },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true, title: true, priority: true, status: true,
      category: true, dueDate: true, amount: true, createdAt: true,
    },
  })

  const senderName = allEmails[0]?.emailFrom ?? emailDecoded
  const openTasks = tasks.filter(t => t.status !== "DONE")
  const doneTasks = tasks.filter(t => t.status === "DONE")

  // Category breakdown of emails
  const catCounts: Record<string, number> = {}
  for (const e of allEmails) {
    const c = e.suggestedCategory ?? "OTHER"
    catCounts[c] = (catCounts[c] ?? 0) + 1
  }
  const topCategories = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 4)

  // Last 5 emails (most recent)
  const recentEmails = allEmails.slice(0, 5)
  const olderEmails = allEmails.slice(5)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <Link href="/dashboard/contacts" className="text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All contacts
      </Link>

      {/* Contact header */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-gray-300">{initials(emailDecoded)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white truncate">{senderName}</h1>
            <p className="text-sm text-gray-500 truncate">{emailDecoded}</p>
            <div className="flex items-center gap-4 mt-3">
              <div className="text-center">
                <p className="text-xl font-bold text-white">{allEmails.length}</p>
                <p className="text-xs text-gray-500">emails</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white">{tasks.length}</p>
                <p className="text-xs text-gray-500">tasks</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-green-400">{doneTasks.length}</p>
                <p className="text-xs text-gray-500">done</p>
              </div>
              {openTasks.length > 0 && (
                <div className="text-center">
                  <p className="text-xl font-bold text-orange-400">{openTasks.length}</p>
                  <p className="text-xs text-gray-500">open</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Category tags */}
        {topCategories.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-800">
            {topCategories.map(([cat, count]) => (
              <span key={cat} className={`text-xs border px-2.5 py-1 rounded-full ${CATEGORY_COLOURS[cat] ?? CATEGORY_COLOURS.OTHER}`}>
                {CATEGORY_LABELS[cat] ?? cat} · {count}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Open tasks */}
      {openTasks.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Open tasks · {openTasks.length}</p>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800">
            {openTasks.map(t => (
              <Link
                key={t.id}
                href={`/dashboard/tasks/${t.id}`}
                className={`flex items-start gap-3 px-5 py-3.5 hover:bg-gray-800/50 transition-colors border-l-4 ${
                  t.priority === "URGENT" ? "border-l-red-500" :
                  t.priority === "HIGH" ? "border-l-orange-500" :
                  t.priority === "MEDIUM" ? "border-l-yellow-500" : "border-l-gray-700"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{t.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs ${PRIORITY_COLOUR[t.priority]}`}>{t.priority}</span>
                    <span className={`text-xs ${CATEGORY_COLOURS[t.category]?.split(" ")[0] ?? "text-gray-500"}`}>
                      {CATEGORY_LABELS[t.category] ?? t.category}
                    </span>
                    {t.dueDate && (
                      <span className="text-xs text-gray-600">
                        · Due {formatDate(t.dueDate)}
                      </span>
                    )}
                    {t.amount && <span className="text-xs text-green-400">· {t.amount}</span>}
                  </div>
                </div>
                <span className="text-xs text-gray-600 flex-shrink-0 mt-0.5">{formatDate(t.createdAt)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent emails (last 5, highlighted) */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Recent emails · last {recentEmails.length}
        </p>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800">
          {recentEmails.map((e, i) => (
            <div key={e.id} className={`px-5 py-4 ${i === 0 ? "bg-gray-800/40" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {i === 0 && (
                      <span className="text-xs bg-blue-900/60 text-blue-400 border border-blue-800 px-2 py-0.5 rounded-full">Latest</span>
                    )}
                    <span className={`text-xs border px-2 py-0.5 rounded-full ${CATEGORY_COLOURS[e.suggestedCategory ?? "OTHER"] ?? CATEGORY_COLOURS.OTHER}`}>
                      {CATEGORY_LABELS[e.suggestedCategory ?? "OTHER"] ?? "Other"}
                    </span>
                    {(e.suggestedPriority === "URGENT" || e.suggestedPriority === "HIGH") && (
                      <span className={`text-xs font-semibold ${PRIORITY_COLOUR[e.suggestedPriority]}`}>
                        {e.suggestedPriority}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-white">{e.emailSubject}</p>
                  {e.suggestedDescription && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{e.suggestedDescription}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-gray-600">{formatDate(e.emailReceivedAt)}</span>
                    {e.status === "APPROVED" && <span className="text-xs text-green-500">✓ Task created</span>}
                    {e.status === "DISMISSED" && <span className="text-xs text-gray-600">Dismissed</span>}
                    {e.status === "PENDING" && e.confidence > 0 && (
                      <Link href="/dashboard/review" className="text-xs text-blue-400 hover:text-blue-300">
                        Review →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Older email history */}
      {olderEmails.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Full history · {olderEmails.length} more emails
          </p>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800">
            {olderEmails.map(e => (
              <div key={e.id} className="px-5 py-3 flex items-start gap-3">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${PRIORITY_DOT[e.suggestedPriority ?? "LOW"] ?? "bg-gray-600"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300 truncate">{e.emailSubject}</p>
                  {e.suggestedDescription && (
                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">{e.suggestedDescription}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {e.status === "APPROVED" && <span className="text-xs text-green-600">✓</span>}
                  <span className="text-xs text-gray-700">{formatDate(e.emailReceivedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed tasks */}
      {doneTasks.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Completed tasks · {doneTasks.length}</p>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800">
            {doneTasks.map(t => (
              <Link key={t.id} href={`/dashboard/tasks/${t.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-800/30 transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-gray-500 line-through flex-1 truncate">{t.title}</p>
                <span className="text-xs text-gray-700 flex-shrink-0">{formatDate(t.createdAt)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
