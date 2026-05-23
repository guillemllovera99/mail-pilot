export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const q = req.nextUrl.searchParams.get("q")?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const tasks = await prisma.task.findMany({
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
    orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "desc" }],
    take: 30,
  })

  // Also search comments
  const comments = await prisma.taskComment.findMany({
    where: {
      content: { contains: q, mode: "insensitive" },
      task: { userId: session.user.id },
    },
    include: { task: true },
    take: 10,
  })

  // Merge — avoid duplicates
  const taskIds = new Set(tasks.map(t => t.id))
  const extraFromComments = comments
    .map(c => c.task)
    .filter(t => !taskIds.has(t.id))

  return NextResponse.json({ results: [...tasks, ...extraFromComments] })
}
