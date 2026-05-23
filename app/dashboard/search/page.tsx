export const dynamic = "force-dynamic"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"

const PRIORITY_DOT: Record<string, string> = {
  URGENT: "bg-red-500", HIGH: "bg-orange-500", MEDIUM: "bg-yellow-500", LOW: "bg-gray-600",
}
const CATEGORY_COLOURS: Record<string, string> = {
  FINANCE: "text-green-400 border-green-800", LEGAL: "text-purple-400 border-purple-800",
  BOARD: "text-blue-400 border-blue-800", HR: "text-pink-400 border-pink-800",
  INVESTORS: "text-yellow-400 border-yellow-800", OPERATIONS: "text-orange-400 border-orange-800",
  PERSONAL: "text-gray-400 border-gray-700", OTHER: "text-gray-500 border-gray-700",
}
const CATEGORY_LABELS: Record<string, string> = {
  FINANCE: "Finance", LEGAL: "Legal", BOARD: "Board", HR: "HR",
  INVESTORS: "Investors", OPERATIONS: "Ops", PERSONAL: "Personal", OTHER: "Other",
}
const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open", IN_PROGRESS: "In progress", WAITING: "Waiting", DONE: "Done", CANCELLED: "Cancelled",
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login")

  const q = searchParams.q?.trim() ?? ""

  let tasks: Awaited<ReturnType<typeof prisma.task.findMany>> = []

  if (q.length >= 2) {
    tasks = await prisma.task.findMany({
      where: {
        userId: session.user.id,
        status: { not: "CANCELLED" },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { emailFrom: { contains: q, mode: "insensitive" } },
          { emailSubject: { contains: q, mode: "insensitive" } },
          { assigneeName: { contains: q, mode: "insensitive" } },
          { amount: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      take: 40,
    })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">
          {q ? `Results for "${q}"` : "Search tasks"}
        </h1>
        {q && (
          <p className="text-sm text-gray-500 mt-0.5">
            {tasks.length} result{tasks.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {!q && (
        <p className="text-gray-500 text-sm">Type in the search bar above to find tasks, notes, contacts, or amounts.</p>
      )}

      {q && tasks.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl px-6 py-12 text-center">
          <p className="text-white font-semibold">No results</p>
          <p className="text-gray-500 text-sm mt-1">Nothing matched "{q}"</p>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800">
          {tasks.map(t => (
            <Link
              key={t.id}
              href={`/dashboard/tasks/${t.id}`}
              className="flex items-start gap-3 px-5 py-4 hover:bg-gray-800/50 transition-colors group"
            >
              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${PRIORITY_DOT[t.priority] ?? "bg-gray-600"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">{t.title}</p>
                {t.description && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{t.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-xs text-gray-600">{STATUS_LABELS[t.status]}</span>
                  {t.emailFrom && <span className="text-xs text-gray-600">· {t.emailFrom}</span>}
                  {t.dueDate && (
                    <span className="text-xs text-gray-600">
                      · Due {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(t.dueDate))}
                    </span>
                  )}
                  {t.amount && <span className="text-xs text-green-400">· {t.amount}</span>}
                </div>
              </div>
              <span className={`text-xs border px-2 py-0.5 rounded-full flex-shrink-0 mt-1 ${CATEGORY_COLOURS[t.category] ?? CATEGORY_COLOURS.OTHER}`}>
                {CATEGORY_LABELS[t.category] ?? "Other"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
