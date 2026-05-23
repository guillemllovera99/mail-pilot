export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { subject, from } = body as { subject: string; from: string }

  if (!subject) return NextResponse.json({ error: "Subject required" }, { status: 400 })

  // Create a task directly from email data (no AI extraction)
  const task = await prisma.task.create({
    data: {
      userId: session.user.id,
      title: subject.slice(0, 120),
      description: from ? `Email from ${from}` : null,
      priority: "MEDIUM",
      category: "OTHER",
      status: "OPEN",
      emailFrom: from ?? null,
      emailSubject: subject ?? null,
    },
  })

  return NextResponse.json({ ok: true, taskId: task.id })
}
