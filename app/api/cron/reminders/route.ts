export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { sendReminderEmail, buildReminderHtml } from "@/lib/email"

export const maxDuration = 60

function dueLabel(dueDate: Date): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return `${Math.abs(diff)} day${Math.abs(diff) !== 1 ? "s" : ""} overdue`
  if (diff === 0) return "Today"
  if (diff === 1) return "Tomorrow"
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(dueDate)
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3001"

  // Find all unsent reminders that are due now or in the past
  const reminders = await prisma.reminder.findMany({
    where: {
      sent: false,
      remindAt: { lte: new Date() },
    },
    include: {
      task: true,
      user: { select: { id: true, email: true } },
    },
  })

  let sent = 0
  let errors = 0

  for (const reminder of reminders) {
    if (!reminder.user.email || reminder.task.status === "DONE" || reminder.task.status === "CANCELLED") {
      // Mark as sent to avoid future retries
      await prisma.reminder.update({ where: { id: reminder.id }, data: { sent: true, sentAt: new Date() } })
      continue
    }

    try {
      const label = reminder.task.dueDate ? dueLabel(reminder.task.dueDate) : "soon"
      const html = buildReminderHtml({
        taskTitle: reminder.task.title,
        priority: reminder.task.priority,
        dueLabel: label,
        amount: reminder.task.amount,
        appUrl,
        taskId: reminder.task.id,
      })

      await sendReminderEmail(
        reminder.user.id,
        reminder.user.email,
        `Reminder: ${reminder.task.title}`,
        html
      )

      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { sent: true, sentAt: new Date() },
      })

      sent++
      console.log(`[reminders] sent → ${reminder.user.email} task="${reminder.task.title}"`)
    } catch (err) {
      errors++
      console.error(`[reminders] error id=${reminder.id}:`, err)
    }
  }

  return NextResponse.json({ ok: true, sent, errors })
}
