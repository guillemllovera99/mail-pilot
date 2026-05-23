export const dynamic = "force-dynamic"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"

function fmtDate(iso: Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(iso)
}

function groupByDate(tasks: { id: string; title: string; completedAt: Date | null; priority: string; emailFrom: string | null }[]) {
  const groups: Record<string, typeof tasks> = {}
  for (const t of tasks) {
    const key = t.completedAt ? fmtDate(t.completedAt) : "Unknown"
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  }
  return groups
}

const PRIORITY_DOT: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH:   "bg-orange-500",
  MEDIUM: "bg-yellow-500",
  LOW:    "bg-gray-500",
}

export default async function DoneTasksPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const tasks = await prisma.task.findMany({
    where: { userId: session.user.id, status: "DONE" },
    orderBy: { completedAt: "desc" },
    take: 100,
  })

  const groups = groupByDate(tasks)

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-10">
      <div className="w-full max-w-xl mx-auto space-y-6">

        <div>
          <Link href="/dashboard/tasks" className="text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1 mb-3">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Open tasks
          </Link>
          <h1 className="text-xl font-bold text-white">Completed</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tasks.length} task{tasks.length !== 1 ? "s" : ""} done</p>
        </div>

        {tasks.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-10 text-center">
            <p className="text-gray-500 text-sm">Nothing completed yet.</p>
          </div>
        )}

        {Object.entries(groups).map(([date, group]) => (
          <div key={date} className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">{date}</p>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800">
              {group.map(t => (
                <Link
                  key={t.id}
                  href={`/dashboard/tasks/${t.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[t.priority] ?? "bg-gray-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-400 text-sm line-through truncate">{t.title}</p>
                    {t.emailFrom && (
                      <p className="text-gray-600 text-xs truncate">{t.emailFrom}</p>
                    )}
                  </div>
                  <svg className="w-3 h-3 text-gray-700 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
