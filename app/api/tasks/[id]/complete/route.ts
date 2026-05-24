export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

const RECURRENCE_DAYS: Record<string, number> = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30,
  QUARTERLY: 90,
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const task = await prisma.task.findUnique({
    where: { id: params.id },
  })

  if (!task || task.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.task.update({
    where: { id: params.id },
    data: {
      status: "DONE",
      completedAt: new Date(),
    },
  })

  // If recurring, create the next occurrence
  let nextTaskId: string | null = null
  const taskAny = task as any
  const rule: string = taskAny.recurrenceRule ?? "NONE"
  if (rule !== "NONE" && RECURRENCE_DAYS[rule]) {
    const days = RECURRENCE_DAYS[rule]
    const base = task.dueDate ?? new Date()
    const nextDue = new Date(base.getTime() + days * 86400000)

    const next = await (prisma.task.create as any)({
      data: {
        userId: task.userId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        category: task.category,
        status: "OPEN",
        dueDate: nextDue,
        emailFrom: task.emailFrom,
        emailSubject: task.emailSubject,
        tags: task.tags,
        amount: task.amount,
        assigneeName: task.assigneeName,
        recurrenceRule: rule,
      },
    })
    nextTaskId = next.id
  }

  return NextResponse.json({ ok: true, nextTaskId })
}
