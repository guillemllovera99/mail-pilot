export const dynamic = "force-dynamic"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { TaskEditor } from "@/components/task-editor"
import Link from "next/link"

export default async function TaskDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: { comments: { orderBy: { createdAt: "asc" } } },
  })

  if (!task || task.userId !== session.user.id) notFound()

  const serialised = {
    ...task,
    dueDate: task.dueDate?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    comments: task.comments.map(c => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-10">
      <div className="w-full max-w-xl mx-auto">
        <Link
          href="/dashboard/tasks"
          className="text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1 mb-6"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          All tasks
        </Link>
        <TaskEditor task={serialised as any} />
      </div>
    </div>
  )
}
