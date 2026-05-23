export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const task = await prisma.task.findUnique({ where: { id: params.id } })
  if (!task || task.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { content } = await req.json()
  if (!content?.trim()) {
    return NextResponse.json({ error: "Content required" }, { status: 400 })
  }

  const comment = await prisma.taskComment.create({
    data: { taskId: params.id, content: content.trim() },
  })

  return NextResponse.json({ ok: true, comment })
}
