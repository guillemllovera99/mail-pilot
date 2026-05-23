export const dynamic = "force-dynamic"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ExtractButton } from "@/components/extract-button"
import { SyncButton } from "@/components/sync-button"

const CATEGORY_LABELS: Record<string, string> = {
  FINANCE: "Finance", LEGAL: "Legal", BOARD: "Board",
  HR: "HR", INVESTORS: "Investors", OPERATIONS: "Operations",
  PERSONAL: "Personal", OTHER: "Other",
}

const CATEGORY_COLOURS: Record<string, string> = {
  FINANCE: "text-green-400 bg-green-900/30 border-green-800",
  LEGAL: "text-purple-400 bg-purple-900/30 border-purple-800",
  BOARD: "text-blue-400 bg-blue-900/30 border-blue-800",
  HR: "text-pink-400 bg-pink-900/30 border-pink-800",
  INVESTORS: "text-yellow-400 bg-yellow-900/30 border-yellow-800",
  OPERATIONS: "text-orange-400 bg-orange-900/30 border-orange-800",
  PERSONAL: "text-gray-400 bg-gray-800 border-gray-700",
  OTHER: "text-gray-500 bg-gray-800/50 border-gray-700",
}

function fmtDate(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const today = new Date()
  const diffDays = Math.ceil((d.getTime() - today.setHours(0,0,0,0)) / 86400000)
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`
  if (diffDays === 0) return "Due today"
  if (diffDays === 1) return "Due tomorrow"
  return `Due ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d)}`
}

const PRIORITY_DOT: Record<string, string> = {
  URGENT: "bg-red-500", HIGH: "bg-orange-500", MEDIUM: "bg-yellow-500", LOW: "bg-gray-500",
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login")

  const userId = session.user.id
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0)
  const todayEnd = new Date(now); todayEnd.setHours(23,59,59,999)
  const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7); weekEnd.setHours(23,59,59,999)

  const [
    openTasks,
    overdueTasks,
    todayTasks,
    weekTasks,
    syncState,
    reviewCount,
    unprocessedCount,
    completedToday,
  ] = await Promise.all([
    prisma.task.count({ where: { userId, status: { in: ["OPEN","IN_PROGRESS","WAITING"] } } }),
    prisma.task.findMany({
      where: { userId, status: { in: ["OPEN","IN_PROGRESS","WAITING"] }, dueDate: { lt: todayStart } },
      orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
      take: 5,
    }),
    prisma.task.findMany({
      where: { userId, status: { in: ["OPEN","IN_PROGRESS","WAITING"] }, dueDate: { gte: todayStart, lte: todayEnd } },
      orderBy: [{ priority: "asc" }],
      take: 5,
    }),
    prisma.task.count({
      where: { userId, status: { in: ["OPEN","IN_PROGRESS","WAITING"] }, dueDate: { gt: todayEnd, lte: weekEnd } },
    }),
    prisma.emailSyncState.findUnique({ where: { userId } }),
    prisma.emailSuggestion.count({ where: { userId, status: "PENDING", confidence: { gt: 0.15 } } }),
    prisma.emailSuggestion.count({ where: { userId, status: "PENDING", confidence: 0 } }),
    prisma.task.count({ where: { userId, status: "DONE", completedAt: { gte: todayStart } } }),
  ])

  // Category breakdown
  const categoryGroups = await prisma.task.groupBy({
    by: ["category"],
    where: { userId, status: { in: ["OPEN","IN_PROGRESS","WAITING"] } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  })

  const attentionTasks = [...overdueTasks, ...todayTasks].slice(0, 6)

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return "Good morning"
    if (h < 17) return "Good afternoon"
    return "Good evening"
  }

  const firstName = session.user.name?.split(" ")[0] ?? "there"

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{greeting()}, {firstName}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {new Intl.DateTimeFormat("en-US", { weekday:"long", month:"long", day:"numeric" }).format(new Date())}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <SyncButton compact />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-red-900/50 rounded-2xl p-4">
          <p className="text-3xl font-bold text-red-400">{overdueTasks.length}</p>
          <p className="text-xs text-gray-500 mt-1">Overdue</p>
        </div>
        <div className="bg-gray-900 border border-orange-900/50 rounded-2xl p-4">
          <p className="text-3xl font-bold text-orange-400">{todayTasks.length}</p>
          <p className="text-xs text-gray-500 mt-1">Due today</p>
        </div>
        <div className="bg-gray-900 border border-blue-900/50 rounded-2xl p-4">
          <p className="text-3xl font-bold text-blue-400">{weekTasks}</p>
          <p className="text-xs text-gray-500 mt-1">Due this week</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-3xl font-bold text-white">{openTasks}</p>
          <p className="text-xs text-gray-500 mt-1">Total open</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* Needs attention */}
          {attentionTasks.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Needs attention</p>
                <span className="text-xs text-gray-600">{attentionTasks.length} tasks</span>
              </div>
              <div className="divide-y divide-gray-800">
                {attentionTasks.map(t => (
                  <Link
                    key={t.id}
                    href={`/dashboard/tasks/${t.id}`}
                    className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-800/50 transition-colors group"
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${PRIORITY_DOT[t.priority] ?? "bg-gray-500"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate group-hover:text-blue-400 transition-colors">{t.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {t.dueDate && (
                          <span className={`text-xs ${new Date(t.dueDate) < todayStart ? "text-red-400" : "text-orange-400"}`}>
                            {fmtDate(t.dueDate.toISOString())}
                          </span>
                        )}
                        {t.emailFrom && (
                          <span className="text-xs text-gray-600 truncate">{t.emailFrom}</span>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${CATEGORY_COLOURS[t.category] ?? CATEGORY_COLOURS.OTHER}`}>
                      {CATEGORY_LABELS[t.category] ?? "Other"}
                    </span>
                  </Link>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-gray-800">
                <Link href="/dashboard/tasks" className="text-xs text-blue-500 hover:text-blue-400 transition-colors">
                  View all tasks →
                </Link>
              </div>
            </div>
          )}

          {attentionTasks.length === 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl px-6 py-10 text-center">
              <div className="w-12 h-12 rounded-xl bg-green-900/30 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-semibold">All clear</p>
              <p className="text-gray-500 text-sm mt-1">Nothing overdue or due today.</p>
            </div>
          )}

          {/* Quick links */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/dashboard/board" className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-5 group transition-colors">
              <div className="w-9 h-9 rounded-xl bg-blue-900/40 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              </div>
              <p className="text-white font-semibold text-sm">Board view</p>
              <p className="text-gray-500 text-xs mt-1">Drag tasks across stages</p>
            </Link>

            <Link href="/dashboard/tasks" className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-5 group transition-colors">
              <div className="w-9 h-9 rounded-xl bg-purple-900/40 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-white font-semibold text-sm">All tasks</p>
              <p className="text-gray-500 text-xs mt-1">{openTasks} open · {completedToday} done today</p>
            </Link>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">

          {/* AI suggestions */}
          {(reviewCount > 0 || unprocessedCount > 0) && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AI inbox</p>
              {reviewCount > 0 && (
                <Link href="/dashboard/review" className="flex items-center justify-between group">
                  <div>
                    <p className="text-sm font-semibold text-purple-400">{reviewCount} to review</p>
                    <p className="text-xs text-gray-600">Tap to approve or dismiss</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )}
              {unprocessedCount > 0 && (
                <div className="pt-2 border-t border-gray-800">
                  <p className="text-xs text-gray-600 mb-2">{unprocessedCount} emails awaiting AI</p>
                  <ExtractButton />
                </div>
              )}
            </div>
          )}

          {/* Category breakdown */}
          {categoryGroups.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">By category</p>
              <div className="space-y-2">
                {categoryGroups.map(g => (
                  <Link
                    key={g.category}
                    href={`/dashboard/tasks?category=${g.category}`}
                    className="flex items-center justify-between group"
                  >
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLOURS[g.category] ?? CATEGORY_COLOURS.OTHER}`}>
                      {CATEGORY_LABELS[g.category] ?? g.category}
                    </span>
                    <span className="text-sm font-semibold text-gray-400 group-hover:text-white transition-colors">
                      {g._count.id}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Sync status */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Inbox sync</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Last synced</span>
                <span className="text-gray-400">
                  {syncState?.lastSyncedAt
                    ? new Intl.DateTimeFormat("en-US", { hour:"numeric", minute:"2-digit" }).format(new Date(syncState.lastSyncedAt))
                    : "Never"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Emails processed</span>
                <span className="text-gray-400">{syncState?.emailsProcessedTotal ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
