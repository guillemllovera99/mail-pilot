import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { SignOutButton } from "@/components/sign-out-button"
import { SyncButton } from "@/components/sync-button"
import { ExtractButton } from "@/components/extract-button"
import Link from "next/link"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const name = session.user?.name ?? session.user?.email ?? "there"

  const syncState = await prisma.emailSyncState.findUnique({
    where: { userId: session.user.id },
  })

  // Not yet AI-processed (confidence = 0)
  const unprocessedCount = await prisma.emailSuggestion.count({
    where: { userId: session.user.id, status: "PENDING", confidence: 0 },
  })

  // AI-processed and ready to review
  const reviewCount = await prisma.emailSuggestion.count({
    where: {
      userId: session.user.id,
      status: "PENDING",
      confidence: { gt: 0 },
    },
  })

  const totalEmails = syncState?.emailsProcessedTotal ?? 0

  const lastSync = syncState?.lastSyncedAt
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(syncState.lastSyncedAt)
    : null

  const openTasks = await prisma.task.count({
    where: { userId: session.user.id, status: "OPEN" },
  })

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-4">

        {/* Header card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl text-center">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-600/30">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">
            Hey, {name.split(" ")[0]} 👋
          </h1>
          <p className="text-gray-500 text-sm mb-6">{session.user?.email}</p>

          <div className="flex flex-col items-center gap-3">
            <SyncButton />
            {unprocessedCount > 0 && <ExtractButton />}
          </div>
        </div>

        {/* Tasks CTA */}
        {openTasks > 0 && (
          <Link
            href="/dashboard/tasks"
            className="block bg-blue-900/30 border border-blue-700/50 hover:border-blue-600 rounded-2xl p-5 shadow-lg transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-700/50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">
                    {openTasks} open task{openTasks !== 1 ? "s" : ""}
                  </p>
                  <p className="text-blue-400 text-xs mt-0.5">Tap to view and manage →</p>
                </div>
              </div>
              <svg className="w-4 h-4 text-blue-500 group-hover:text-blue-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        )}

        {/* Review CTA */}
        {reviewCount > 0 && (
          <Link
            href="/dashboard/review"
            className="block bg-purple-900/30 border border-purple-700/50 hover:border-purple-600 rounded-2xl p-5 shadow-lg transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-700/50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.346.346a.5.5 0 01-.353.147H9.172a.5.5 0 01-.353-.147l-.345-.346z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">
                    {reviewCount} AI suggestion{reviewCount !== 1 ? "s" : ""} to review
                  </p>
                  <p className="text-purple-400 text-xs mt-0.5">Tap to approve or dismiss →</p>
                </div>
              </div>
              <svg className="w-4 h-4 text-purple-500 group-hover:text-purple-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        )}

        {/* Stats */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Inbox sync</p>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Last synced</span>
              <span className="text-gray-300">{lastSync ?? "Never"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Emails stored</span>
              <span className="text-gray-300">{totalEmails.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Awaiting AI</span>
              <span className={unprocessedCount > 0 ? "text-yellow-400" : "text-gray-300"}>
                {unprocessedCount.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Ready to review</span>
              <span className={reviewCount > 0 ? "text-purple-400" : "text-gray-300"}>
                {reviewCount.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Open tasks</span>
              <span className={openTasks > 0 ? "text-blue-400" : "text-gray-300"}>
                {openTasks.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}
