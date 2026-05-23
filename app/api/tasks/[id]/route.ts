import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function PATCH(
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

  const body = await req.json()
  const { title, description, priority, dueDate, status } = body

  const updated = await prisma.task.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title: String(title).slice(0, 200) }),
      ...(description !== undefined && { description: description ?? null }),
      ...(priority !== undefined && { priority }),
      ...(dueDate !== undefined && {
        dueDate: dueDate ? new Date(dueDate) : null,
      }),
      ...(status !== undefined && {
        status,
        completedAt: status === "DONE" ? new Date() : status === "OPEN" ? null : undefined,
      }),
    },
  })

  return NextResponse.json({ ok: true, task: updated })
}
