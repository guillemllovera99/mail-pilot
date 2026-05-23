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

  const { remindAt } = await req.json()
  if (!remindAt) return NextResponse.json({ error: "remindAt required" }, { status: 400 })

  const remindDate = new Date(remindAt)
  if (isNaN(remindDate.getTime()) || remindDate <= new Date()) {
    return NextResponse.json({ error: "remindAt must be a future date" }, { status: 400 })
  }

  const reminder = await prisma.reminder.create({
    data: {
      taskId: task.id,
      userId: session.user.id,
      remindAt: remindDate,
    },
  })

  return NextResponse.json({ ok: true, reminderId: reminder.id })
}
