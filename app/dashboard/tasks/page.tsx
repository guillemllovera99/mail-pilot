export const dynamic = "force-dynamic"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { TaskCard, TaskItem } from "@/components/task-card"
import Link from "next/link"

const PRIORITY_ORDER = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

const CATEGORIES = ["FINANCE", "LEGAL", "BOARD", "HR", "INVESTORS", "OPERATIONS", "PERSONAL", "OTHER"]
const CATEGORY_LABELS: Record<string, string> = {
  FINANCE: "Finance", LEGAL: "Legal", BOARD: "Board", HR: "HR",
  INVESTORS: "Investors", OPERATIONS: "Ops", PERSONAL: "Personal", OTHER: "Other",
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: { category?: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const activeCategory = searchParams.category ?? ""

  const where = {
    userId: session.user.id,
    status: "OPEN" as const,
    ...(activeCategory ? { category: activeCategory } : {}),
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  })

  const sorted = [...tasks].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 3
    const pb = PRIORITY_ORDER[b.priority] ?? 3
    if (pa !== pb) return pa - pb
    if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return 0
  })

  const groups: Record<string, typeof tasks> = { URGENT: [], HIGH: [], MEDIUM: [], LOW: [] }
  for (const t of sorted) { groups[t.priority]?.push(t) }

  const serialise = (t: typeof tasks[0]): TaskItem => ({
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority as TaskItem["priority"],
    category: t.category,
    dueDate: t.dueDate?.toISOString() ?? null,
    tags: t.tags,
    amount: t.amount,
    assigneeName: t.assigneeName,
    emailFrom: t.emailFrom,
    emailSubject: t.emailSubject,
    createdAt: t.createdAt.toISOString(),
  })

  // Category counts (always over all open tasks)
  const allOpen = await prisma.task.groupBy({
    by: ["category"],
    where: { userId: session.user.id, status: "OPEN" },
    _count: { id: true },
  })
  const categoryCounts = Object.fromEntries(allOpen.map(g => [g.category, g._count.id]))
  const totalOpen = allOpen.reduce((s, g) => s + g._count.id, 0)

  const completedToday = await prisma.task.count({
    where: {
      userId: session.user.id,
      status: "DONE",
      completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
  })

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Intl.DateTimeFormat("en-US", { weekday:"long", month:"long", day:"numeric" }).format(new Date())}
          </p>
        </div>
        <Link href="/dashboard/board" className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
          </svg>
          Board view
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-white">{totalOpen}</p>
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

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <Link
          href="/dashboard/tasks"
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            !activeCategory
              ? "bg-white text-gray-900 border-white"
              : "text-gray-400 border-gray-700 hover:border-gray-500"
          }`}
        >
          All ({totalOpen})
        </Link>
        {CATEGORIES.filter(c => categoryCounts[c]).map(c => (
          <Link
            key={c}
            href={`/dashboard/tasks?category=${c}`}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              activeCategory === c
                ? "bg-white text-gray-900 border-white"
                : "text-gray-400 border-gray-700 hover:border-gray-500"
            }`}
          >
            {CATEGORY_LABELS[c]} ({categoryCounts[c]})
          </Link>
        ))}
      </div>

      {/* Empty */}
      {tasks.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-green-900/40 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-white font-semibold">
            {activeCategory ? `No open ${CATEGORY_LABELS[activeCategory]} tasks` : "All clear!"}
          </p>
        </div>
      )}

      {/* Priority groups */}
      {(["URGENT", "HIGH", "MEDIUM", "LOW"] as const).map(priority => {
        const group = groups[priority]
        if (!group || group.length === 0) return null
        const LABEL: Record<string, string> = {
          URGENT: "🔴 Urgent", HIGH: "🟠 High priority", MEDIUM: "🟡 Medium", LOW: "⚪ Low priority",
        }
        return (
          <div key={priority} className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
              {LABEL[priority]} · {group.length}
            </p>
            {group.map(t => <TaskCard key={t.id} task={serialise(t)} />)}
          </div>
        )
      })}

      <Link
        href="/dashboard/tasks/done"
        className="flex items-center justify-center gap-2 text-gray-600 hover:text-gray-400 text-sm py-3 transition-colors"
      >
        View completed tasks →
      </Link>
    </div>
  )
}
