export const dynamic = "force-dynamic"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { CalendarView, CalendarTask } from "@/components/calendar-view"

export default async function CalendarPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login")

  // Fetch tasks that have a due date, or were completed in the last 60 days, or are open
  const tasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      status: { not: "CANCELLED" },
      OR: [
        { dueDate: { not: null } },
        { status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] } },
      ],
    },
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      title: true,
      priority: true,
      status: true,
      category: true,
      dueDate: true,
    },
  })

  const serialised: CalendarTask[] = tasks.map(t => ({
    id: t.id,
    title: t.title,
    priority: t.priority as CalendarTask["priority"],
    status: t.status as CalendarTask["status"],
    category: t.category,
    dueDate: t.dueDate?.toISOString() ?? null,
  }))

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Calendar</h1>
        <p className="text-sm text-gray-500 mt-0.5">Tasks by due date</p>
      </div>
      <CalendarView tasks={serialised} />
    </div>
  )
}
