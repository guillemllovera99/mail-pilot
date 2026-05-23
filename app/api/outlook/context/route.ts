export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const subject = req.nextUrl.searchParams.get("subject")?.trim() ?? ""
  const from = req.nextUrl.searchParams.get("from")?.trim() ?? ""

  type TaskRow = { id: string; title: string; priority: string; status: string; category: string; dueDate: Date | null; amount: string | null }

  // Tasks from this sender or matching subject
  let tasks: TaskRow[] = []
  if (subject || from) {
    const orClauses: object[] = []
    if (from) orClauses.push({ emailFrom: { contains: from, mode: "insensitive" as const } })
    if (subject) orClauses.push({ emailSubject: { contains: subject, mode: "insensitive" as const } })

    tasks = await prisma.task.findMany({
      where: {
        userId: session.user.id,
        status: { not: "CANCELLED" },
        OR: orClauses,
      },
      orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "desc" }],
      take: 10,
      select: {
        id: true, title: true, priority: true, status: true,
        category: true, dueDate: true, amount: true,
      },
    })
  }

  // Pending suggestion for this email
  let suggestion: Awaited<ReturnType<typeof prisma.emailSuggestion.findFirst>> | null = null
  if (subject || from) {
    const sOrClauses: object[] = []
    if (from) sOrClauses.push({ emailFrom: { contains: from, mode: "insensitive" as const } })
    if (subject) sOrClauses.push({ emailSubject: { contains: subject, mode: "insensitive" as const } })

    suggestion = await prisma.emailSuggestion.findFirst({
      where: {
        userId: session.user.id,
        status: "PENDING",
        OR: sOrClauses,
      },
      orderBy: { confidence: "desc" },
    })
  }

  // Always return top open tasks for the tasks tab
  const openTasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] },
    },
    orderBy: [{ priority: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    take: 20,
    select: {
      id: true, title: true, priority: true, status: true,
      category: true, dueDate: true, amount: true,
    },
  })

  return NextResponse.json({
    tasks: tasks.map(t => ({
      id: t.id, title: t.title, priority: t.priority,
      status: t.status, category: t.category,
      dueDate: t.dueDate?.toISOString() ?? null,
      amount: t.amount,
    })),
    suggestion: suggestion ? {
      id: suggestion.id,
      emailSubject: suggestion.emailSubject,
      emailFrom: suggestion.emailFrom,
      suggestedTitle: suggestion.suggestedTitle,
      suggestedPriority: suggestion.suggestedPriority,
      suggestedCategory: suggestion.suggestedCategory,
      confidence: suggestion.confidence,
    } : null,
    openTasks: openTasks.map(t => ({
      id: t.id, title: t.title, priority: t.priority,
      status: t.status, category: t.category,
      dueDate: t.dueDate?.toISOString() ?? null,
      amount: t.amount,
    })),
  })
}
