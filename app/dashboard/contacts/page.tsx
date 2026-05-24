export const dynamic = "force-dynamic"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"

const CATEGORY_COLOURS: Record<string, string> = {
  FINANCE: "bg-green-900/50 text-green-400 border-green-800",
  LEGAL: "bg-purple-900/50 text-purple-400 border-purple-800",
  BOARD: "bg-blue-900/50 text-blue-400 border-blue-800",
  HR: "bg-pink-900/50 text-pink-400 border-pink-800",
  INVESTORS: "bg-yellow-900/50 text-yellow-400 border-yellow-800",
  OPERATIONS: "bg-orange-900/50 text-orange-400 border-orange-800",
  PERSONAL: "bg-gray-800 text-gray-400 border-gray-700",
  OTHER: "bg-gray-800 text-gray-500 border-gray-700",
}

const CATEGORY_LABELS: Record<string, string> = {
  FINANCE: "Finance", LEGAL: "Legal", BOARD: "Board", HR: "HR",
  INVESTORS: "Investors", OPERATIONS: "Ops", PERSONAL: "Personal", OTHER: "Other",
}

function initials(email: string): string {
  const name = email.split("@")[0].replace(/[._-]/g, " ")
  const parts = name.split(" ").filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function formatDate(date: Date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 86400000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return `${diff}d ago`
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export default async function ContactsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login")

  // Get all tasks that have an emailFrom
  const tasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      emailFrom: { not: null },
      status: { not: "CANCELLED" },
    },
    select: {
      id: true,
      emailFrom: true,
      category: true,
      priority: true,
      status: true,
      createdAt: true,
      title: true,
    },
    orderBy: { createdAt: "desc" },
  })

  // Group by sender
  const contactMap: Record<string, {
    email: string
    tasks: typeof tasks
    categories: Record<string, number>
    lastActivity: Date
    openCount: number
    doneCount: number
  }> = {}

  for (const t of tasks) {
    const email = t.emailFrom!
    if (!contactMap[email]) {
      contactMap[email] = {
        email,
        tasks: [],
        categories: {},
        lastActivity: t.createdAt,
        openCount: 0,
        doneCount: 0,
      }
    }
    const c = contactMap[email]
    c.tasks.push(t)
    c.categories[t.category] = (c.categories[t.category] ?? 0) + 1
    if (t.createdAt > c.lastActivity) c.lastActivity = t.createdAt
    if (t.status === "DONE") c.doneCount++
    else c.openCount++
  }

  // Sort contacts by total task count desc
  const contacts = Object.values(contactMap).sort((a, b) => b.tasks.length - a.tasks.length)

  // Top categories across all contacts
  const globalCategories: Record<string, number> = {}
  for (const t of tasks) {
    globalCategories[t.category] = (globalCategories[t.category] ?? 0) + 1
  }
  const topCategories = Object.entries(globalCategories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Contacts</h1>
        <p className="text-sm text-gray-500 mt-0.5">Senders who generate tasks for you</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-white">{contacts.length}</p>
          <p className="text-xs text-gray-500 mt-1">Contacts</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-white">{tasks.length}</p>
          <p className="text-xs text-gray-500 mt-1">Tasks from email</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">
            {tasks.length > 0 ? Math.round((tasks.filter(t => t.status === "DONE").length / tasks.length) * 100) : 0}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Completion</p>
        </div>
      </div>

      {/* Top categories */}
      {topCategories.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Top categories from email</p>
          <div className="flex flex-wrap gap-2">
            {topCategories.map(([cat, count]) => (
              <span key={cat} className={`text-xs border px-2.5 py-1 rounded-full ${CATEGORY_COLOURS[cat] ?? CATEGORY_COLOURS.OTHER}`}>
                {CATEGORY_LABELS[cat] ?? cat} · {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Contact list */}
      {contacts.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl px-6 py-12 text-center">
          <p className="text-white font-semibold">No contacts yet</p>
          <p className="text-gray-500 text-sm mt-1">Tasks created from emails will appear here</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800">
          {contacts.map(contact => {
            const topCat = Object.entries(contact.categories).sort((a, b) => b[1] - a[1])[0]
            const completion = contact.tasks.length > 0
              ? Math.round((contact.doneCount / contact.tasks.length) * 100)
              : 0

            return (
              <div key={contact.email} className="px-5 py-4">
                <div className="flex items-start gap-4">
                  {/* Avatar — links to timeline */}
                  <Link
                    href={`/dashboard/contacts/${encodeURIComponent(contact.email)}`}
                    className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0 hover:border-gray-500 transition-colors"
                  >
                    <span className="text-xs font-bold text-gray-400">{initials(contact.email)}</span>
                  </Link>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/dashboard/contacts/${encodeURIComponent(contact.email)}`} className="text-sm font-medium text-white hover:text-blue-400 transition-colors truncate">
                        {contact.email}
                      </Link>
                      <span className="text-xs text-gray-600 flex-shrink-0">{formatDate(contact.lastActivity)}</span>
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-xs text-gray-500">
                        {contact.tasks.length} task{contact.tasks.length !== 1 ? "s" : ""}
                      </span>
                      {contact.openCount > 0 && (
                        <span className="text-xs text-orange-400">{contact.openCount} open</span>
                      )}
                      {contact.doneCount > 0 && (
                        <span className="text-xs text-green-400">{contact.doneCount} done</span>
                      )}
                      {topCat && (
                        <span className={`text-xs border px-2 py-0.5 rounded-full ${CATEGORY_COLOURS[topCat[0]] ?? CATEGORY_COLOURS.OTHER}`}>
                          {CATEGORY_LABELS[topCat[0]] ?? topCat[0]}
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    {contact.tasks.length > 1 && (
                      <div className="mt-2 h-1 bg-gray-800 rounded-full overflow-hidden w-full max-w-[200px]">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${completion}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Search link */}
                  <Link
                    href={`/dashboard/search?q=${encodeURIComponent(contact.email)}`}
                    className="flex-shrink-0 text-gray-600 hover:text-gray-400 transition-colors"
                    title="View all tasks from this contact"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </Link>
                </div>

                {/* Recent task titles */}
                {contact.tasks.slice(0, 2).map(t => (
                  <Link
                    key={t.id}
                    href={`/dashboard/tasks/${t.id}`}
                    className="mt-2 ml-13 flex items-center gap-2 group"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ml-[52px] ${
                      t.status === "DONE" ? "bg-green-700" :
                      t.priority === "URGENT" ? "bg-red-500" :
                      t.priority === "HIGH" ? "bg-orange-500" :
                      t.priority === "MEDIUM" ? "bg-yellow-500" : "bg-gray-600"
                    }`} />
                    <p className={`text-xs truncate group-hover:text-blue-400 transition-colors ${
                      t.status === "DONE" ? "text-gray-600 line-through" : "text-gray-500"
                    }`}>
                      {t.title}
                    </p>
                  </Link>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
