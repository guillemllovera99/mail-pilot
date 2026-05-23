export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

const PRIORITY_UP: Record<string, string> = {
  LOW: "MEDIUM",
  MEDIUM: "HIGH",
  HIGH: "URGENT",
  // URGENT stays URGENT
}

// Only escalate if task has been overdue for at least this many days per priority
const ESCALATE_AFTER_DAYS: Record<string, number> = {
  LOW: 3,      // LOW → MEDIUM after 3 days overdue
  MEDIUM: 2,   // MEDIUM → HIGH after 2 days overdue
  HIGH: 1,     // HIGH → URGENT after 1 day overdue
}

export async function GET(req: Request) {
  const auth = (req as any).headers?.get?.("authorization")
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  try {
    // Find all open/in-progress/waiting tasks with a past due date
    const overdueTasks = await prisma.task.findMany({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] },
        dueDate: { lt: today },
        priority: { not: "URGENT" }, // already at max
      },
      select: {
        id: true,
        priority: true,
        dueDate: true,
        title: true,
      },
    })

    let escalatedCount = 0
    const escalated: { id: string; from: string; to: string; title: string }[] = []

    for (const task of overdueTasks) {
      if (!task.dueDate) continue

      const daysOverdue = Math.floor((today.getTime() - new Date(task.dueDate).getTime()) / 86400000)
      const threshold = ESCALATE_AFTER_DAYS[task.priority]

      if (threshold === undefined) continue
      if (daysOverdue < threshold) continue

      const newPriority = PRIORITY_UP[task.priority]
      if (!newPriority) continue

      await prisma.task.update({
        where: { id: task.id },
        data: { priority: newPriority as "URGENT" | "HIGH" | "MEDIUM" | "LOW" },
      })

      escalated.push({ id: task.id, from: task.priority, to: newPriority, title: task.title })
      escalatedCount++
    }

    console.log(`Escalation cron: ${escalatedCount} tasks escalated`)
    return NextResponse.json({
      ok: true,
      checked: overdueTasks.length,
      escalated: escalatedCount,
      details: escalated,
    })
  } catch (err) {
    console.error("Escalate cron error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
