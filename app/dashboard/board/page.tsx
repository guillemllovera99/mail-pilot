export const dynamic = "force-dynamic"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { KanbanBoard, KanbanTask } from "@/components/kanban-board"

export default async function BoardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login")

  const tasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      status: { in: ["OPEN", "IN_PROGRESS", "WAITING", "DONE"] },
      // Only show recently done tasks on board (last 7 days)
      OR: [
        { status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] } },
        { status: "DONE", completedAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      ],
    },
    orderBy: [{ priority: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  })

  const serialised: KanbanTask[] = tasks.map(t => ({
    id: t.id,
    title: t.title,
    priority: t.priority as KanbanTask["priority"],
    status: t.status as KanbanTask["status"],
    category: t.category,
    dueDate: t.dueDate?.toISOString() ?? null,
    emailFrom: t.emailFrom,
    amount: t.amount,
  }))

  return (
    <div className="px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Board</h1>
          <p className="text-sm text-gray-500 mt-0.5">Drag cards between columns to update status</p>
        </div>
        <KanbanBoard initialTasks={serialised} />
      </div>
    </div>
  )
}
