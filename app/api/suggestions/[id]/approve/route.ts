export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const suggestion = await prisma.emailSuggestion.findUnique({
    where: { id: params.id },
  })

  if (!suggestion || suggestion.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (suggestion.status === "APPROVED") {
    return NextResponse.json({ error: "Already approved" }, { status: 409 })
  }

  // Create a real Task from the suggestion
  const task = await prisma.task.create({
    data: {
      userId: session.user.id,
      title: suggestion.suggestedTitle,
      description: suggestion.suggestedDescription,
      priority: suggestion.suggestedPriority,
      category: suggestion.suggestedCategory,
      dueDate: suggestion.suggestedDueDate,
      tags: suggestion.suggestedTags,
      amount: suggestion.suggestedAmount,
      assigneeName: suggestion.suggestedAssignee,
      emailId: suggestion.emailId,
      emailFrom: suggestion.emailFrom,
      emailSubject: suggestion.emailSubject,
      emailBody: suggestion.suggestedDescription,
      status: "OPEN",
    },
  })

  // Auto-create reminders if the task has a due date
  if (suggestion.suggestedDueDate) {
    const due = new Date(suggestion.suggestedDueDate)
    const reminders: Date[] = []

    // Day before
    const dayBefore = new Date(due)
    dayBefore.setDate(dayBefore.getDate() - 1)
    dayBefore.setHours(9, 0, 0, 0)
    if (dayBefore > new Date()) reminders.push(dayBefore)

    // Day of at 9am
    const dayOf = new Date(due)
    dayOf.setHours(9, 0, 0, 0)
    if (dayOf > new Date()) reminders.push(dayOf)

    await prisma.reminder.createMany({
      data: reminders.map(remindAt => ({
        taskId: task.id,
        userId: session.user.id,
        remindAt,
      })),
    })
  }

  await prisma.emailSuggestion.update({
    where: { id: params.id },
    data: { status: "APPROVED", reviewedAt: new Date() },
  })

  return NextResponse.json({ ok: true, taskId: task.id })
}
