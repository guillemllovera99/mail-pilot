import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { TaskCard, TaskItem } from "@/components/task-card"
import Link from "next/link"

const PRIORITY_ORDER = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

export default async function TasksPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const tasks = await prisma.task.findMany({
    where: { userId: session.user.id, status: "OPEN" },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  })

  // Sort by priority first, then due date
  const sorted = [...tasks].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 3
    const pb = PRIORITY_ORDER[b.priority] ?? 3
    if (pa !== pb) return pa - pb
    if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return 0
  })

  // Group by priority
  const groups: Record<string, typeof tasks> = { URGENT: [], HIGH: [], MEDIUM: [], LOW: [] }
  for (const t of sorted) {
    groups[t.priority]?.push(t)
  }

  const serialise = (t: typeof tasks[0]): TaskItem => ({
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority as TaskItem["priority"],
    dueDate: t.dueDate?.toISOString() ?? null,
    tags: t.tags,
    amount: t.amount,
    assigneeName: t.assigneeName,
    emailFrom: t.emailFrom,
    emailSubject: t.emailSubject,
    createdAt: t.createdAt.toISOString(),
  })

  const completedToday = await prisma.task.count({
    where: {
      userId: session.user.id,
      status: "DONE",
      completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
  })

  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "long", day: "numeric",
  }).format(new Date())

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-10">
      <div className="w-full max-w-xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <Link href="/dashboard" className="text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1 mb-3">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Dashboard
          </Link>
          <h1 className="text-xl font-bold text-white">Your tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">{today}</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{tasks.length}</p>
            <p className="text-xs text-gray-500 mt-1">Open</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-red-400">
              {(groups.URGENT?.length ?? 0) + (groups.HIGH?.length ?? 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">High priority</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{completedToday}</p>
            <p className="text-xs text-gray-500 mt-1">Done today</p>
          </div>
        </div>

        {/* Empty state */}
        {tasks.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-green-900/40 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-semibold">All clear!</p>
            <p className="text-gray-500 text-sm mt-1">No open tasks. Sync your inbox to find new ones.</p>
          </div>
        )}

        {/* Priority groups */}
        {(["URGENT", "HIGH", "MEDIUM", "LOW"] as const).map(priority => {
          const group = groups[priority]
          if (!group || group.length === 0) return null

          const LABEL: Record<string, string> = {
            URGENT: "🔴 Urgent",
            HIGH: "🟠 High priority",
            MEDIUM: "🟡 Medium",
            LOW: "⚪ Low priority",
          }

          return (
            <div key={priority} className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
                {LABEL[priority]} · {group.length}
              </p>
              {group.map(t => (
                <TaskCard key={t.id} task={serialise(t)} />
              ))}
            </div>
          )
        })}

        {/* View completed link */}
        <Link
          href="/dashboard/tasks/done"
          className="flex items-center justify-center gap-2 text-gray-600 hover:text-gray-400 text-sm py-3 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          View completed tasks
        </Link>
      </div>
    </div>
  )
}
