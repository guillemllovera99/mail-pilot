export const dynamic = "force-dynamic"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"

const CATEGORY_COLOURS: Record<string, string> = {
  FINANCE: "#4ade80", LEGAL: "#c084fc", BOARD: "#60a5fa",
  HR: "#f472b6", INVESTORS: "#facc15", OPERATIONS: "#fb923c",
  PERSONAL: "#9ca3af", OTHER: "#6b7280",
}
const CATEGORY_LABELS: Record<string, string> = {
  FINANCE: "Finance", LEGAL: "Legal", BOARD: "Board", HR: "HR",
  INVESTORS: "Investors", OPERATIONS: "Ops", PERSONAL: "Personal", OTHER: "Other",
}
const PRIORITY_COLOURS: Record<string, string> = {
  URGENT: "#ef4444", HIGH: "#f97316", MEDIUM: "#eab308", LOW: "#6b7280",
}

function DonutChart({ slices }: { slices: { label: string; value: number; colour: string }[] }) {
  const total = slices.reduce((s, v) => s + v.value, 0)
  if (total === 0) return <p className="text-gray-600 text-sm text-center py-4">No data</p>

  let cumAngle = -90
  const cx = 80, cy = 80, r = 60, inner = 36

  const paths = slices.map(s => {
    const angle = (s.value / total) * 360
    const start = cumAngle
    const end = cumAngle + angle
    cumAngle += angle

    const toRad = (d: number) => (d * Math.PI) / 180
    const x1 = cx + r * Math.cos(toRad(start))
    const y1 = cy + r * Math.sin(toRad(start))
    const x2 = cx + r * Math.cos(toRad(end))
    const y2 = cy + r * Math.sin(toRad(end))
    const xi1 = cx + inner * Math.cos(toRad(start))
    const yi1 = cy + inner * Math.sin(toRad(start))
    const xi2 = cx + inner * Math.cos(toRad(end))
    const yi2 = cy + inner * Math.sin(toRad(end))
    const large = angle > 180 ? 1 : 0

    return (
      <path
        key={s.label}
        d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${inner} ${inner} 0 ${large} 0 ${xi1} ${yi1} Z`}
        fill={s.colour}
        opacity={0.85}
      />
    )
  })

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 160 160" className="w-32 h-32 flex-shrink-0">
        {paths}
        <text x={cx} y={cy + 5} textAnchor="middle" fill="#f1f5f9" fontSize="14" fontWeight="700">
          {total}
        </text>
      </svg>
      <div className="flex flex-col gap-1.5">
        {slices.map(s => (
          <div key={s.label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.colour }} />
            <span className="text-xs text-gray-400">{s.label}</span>
            <span className="text-xs text-gray-600 ml-auto pl-4">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BarChart({ bars, max }: { bars: { label: string; value: number }[]; max: number }) {
  if (bars.every(b => b.value === 0)) {
    return <p className="text-gray-600 text-sm text-center py-4">No completions yet</p>
  }
  return (
    <div className="flex items-end gap-1 h-24">
      {bars.map(b => (
        <div key={b.label} className="flex flex-col items-center gap-1 flex-1">
          <div
            className="w-full rounded-t-sm bg-blue-600 opacity-80 transition-all min-h-[2px]"
            style={{ height: max > 0 ? `${(b.value / max) * 80}px` : "2px" }}
          />
          <span className="text-gray-700 text-[9px] rotate-45 origin-left">{b.label}</span>
        </div>
      ))}
    </div>
  )
}

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login")

  const userId = session.user.id
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000)

  // ── Core counts ────────────────────────────────────────────────────────────
  const [totalOpen, totalDone, totalCancelled, completedThisMonth] = await Promise.all([
    prisma.task.count({ where: { userId, status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] } } }),
    prisma.task.count({ where: { userId, status: "DONE" } }),
    prisma.task.count({ where: { userId, status: "CANCELLED" } }),
    prisma.task.count({ where: { userId, status: "DONE", completedAt: { gte: thirtyDaysAgo } } }),
  ])

  // ── Completions per day (last 30 days) ────────────────────────────────────
  const recentDone = await prisma.task.findMany({
    where: { userId, status: "DONE", completedAt: { gte: thirtyDaysAgo } },
    select: { completedAt: true },
  })
  const dayMap: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000)
    const key = `${d.getMonth() + 1}/${d.getDate()}`
    dayMap[key] = 0
  }
  for (const t of recentDone) {
    if (!t.completedAt) continue
    const key = `${t.completedAt.getMonth() + 1}/${t.completedAt.getDate()}`
    if (key in dayMap) dayMap[key]++
  }
  const bars = Object.entries(dayMap).map(([label, value]) => ({ label, value }))
  const maxBar = Math.max(...bars.map(b => b.value), 1)

  // ── Category breakdown (open tasks) ───────────────────────────────────────
  const categoryGroups = await prisma.task.groupBy({
    by: ["category"],
    where: { userId, status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] } },
    _count: { id: true },
  })
  const categorySlices = categoryGroups
    .sort((a, b) => b._count.id - a._count.id)
    .map(g => ({
      label: CATEGORY_LABELS[g.category] ?? g.category,
      value: g._count.id,
      colour: CATEGORY_COLOURS[g.category] ?? "#6b7280",
    }))

  // ── Priority breakdown (open tasks) ──────────────────────────────────────
  const priorityGroups = await prisma.task.groupBy({
    by: ["priority"],
    where: { userId, status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] } },
    _count: { id: true },
  })
  const PRIORITY_ORDER = ["URGENT", "HIGH", "MEDIUM", "LOW"]
  const prioritySlices = PRIORITY_ORDER
    .map(p => {
      const g = priorityGroups.find(x => x.priority === p)
      return { label: p, value: g?._count.id ?? 0, colour: PRIORITY_COLOURS[p] }
    })
    .filter(s => s.value > 0)

  // ── Avg completion time (days) ────────────────────────────────────────────
  const tasksWithBoth = await prisma.task.findMany({
    where: { userId, status: "DONE", completedAt: { not: null, gte: ninetyDaysAgo } },
    select: { createdAt: true, completedAt: true },
  })
  const avgDays = tasksWithBoth.length > 0
    ? Math.round(
        tasksWithBoth.reduce((sum, t) => {
          const ms = (t.completedAt!.getTime() - t.createdAt.getTime())
          return sum + ms / 86400000
        }, 0) / tasksWithBoth.length
      )
    : null

  // ── Top senders ────────────────────────────────────────────────────────────
  const emailTasks = await prisma.task.findMany({
    where: { userId, emailFrom: { not: null } },
    select: { emailFrom: true, status: true },
  })
  const senderMap: Record<string, { total: number; done: number }> = {}
  for (const t of emailTasks) {
    const e = t.emailFrom!
    if (!senderMap[e]) senderMap[e] = { total: 0, done: 0 }
    senderMap[e].total++
    if (t.status === "DONE") senderMap[e].done++
  }
  const topSenders = Object.entries(senderMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6)

  // ── Completion rate ────────────────────────────────────────────────────────
  const totalEver = totalOpen + totalDone + totalCancelled
  const completionRate = totalEver > 0 ? Math.round((totalDone / totalEver) * 100) : 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your task performance at a glance</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Open tasks", value: totalOpen, colour: "text-white" },
          { label: "Completed", value: totalDone, colour: "text-green-400" },
          { label: "This month", value: completedThisMonth, colour: "text-blue-400" },
          { label: "Completion rate", value: `${completionRate}%`, colour: "text-purple-400" },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${stat.colour}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Avg completion time */}
      {avgDays !== null && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Average time to complete</p>
            <p className="text-xs text-gray-500 mt-0.5">Based on tasks completed in last 90 days</p>
          </div>
          <p className="text-2xl font-bold text-yellow-400">{avgDays}d</p>
        </div>
      )}

      {/* Completions bar chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Completions — last 30 days
        </p>
        <BarChart bars={bars} max={maxBar} />
      </div>

      {/* Category + Priority donuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Open by category</p>
          <DonutChart slices={categorySlices} />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Open by priority</p>
          <DonutChart slices={prioritySlices} />
        </div>
      </div>

      {/* Top senders */}
      {topSenders.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Top senders by task volume</p>
          </div>
          <div className="divide-y divide-gray-800">
            {topSenders.map(([email, stats]) => {
              const pct = Math.round((stats.done / stats.total) * 100)
              return (
                <div key={email} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden w-24">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">{pct}% done</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-white">{stats.total}</p>
                    <p className="text-xs text-gray-600">tasks</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
