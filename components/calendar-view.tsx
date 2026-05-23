"use client"

import { useState } from "react"
import Link from "next/link"

export interface CalendarTask {
  id: string
  title: string
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW"
  status: "OPEN" | "IN_PROGRESS" | "WAITING" | "DONE" | "CANCELLED"
  category: string
  dueDate: string | null
}

const PRIORITY_DOT: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-yellow-500",
  LOW: "bg-gray-500",
}

const PRIORITY_BORDER: Record<string, string> = {
  URGENT: "border-l-red-500",
  HIGH: "border-l-orange-500",
  MEDIUM: "border-l-yellow-500",
  LOW: "border-l-gray-600",
}

const CATEGORY_COLOURS: Record<string, string> = {
  FINANCE: "text-green-400",
  LEGAL: "text-purple-400",
  BOARD: "text-blue-400",
  HR: "text-pink-400",
  INVESTORS: "text-yellow-400",
  OPERATIONS: "text-orange-400",
  PERSONAL: "text-gray-400",
  OTHER: "text-gray-500",
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function CalendarView({ tasks }: { tasks: CalendarTask[] }) {
  const today = new Date()
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<Date | null>(today)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Build grid: leading blanks + days
  const gridCells: (Date | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ]
  // Pad to full weeks
  while (gridCells.length % 7 !== 0) gridCells.push(null)

  // Index tasks by date string "YYYY-MM-DD"
  const tasksByDate: Record<string, CalendarTask[]> = {}
  for (const t of tasks) {
    if (!t.dueDate) continue
    const d = new Date(t.dueDate)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (!tasksByDate[key]) tasksByDate[key] = []
    tasksByDate[key].push(t)
  }

  const getTasksForDay = (d: Date) => {
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    return tasksByDate[key] ?? []
  }

  const selectedTasks = selectedDay ? getTasksForDay(selectedDay) : []

  // Tasks with no due date
  const noDueDateTasks = tasks.filter(t => !t.dueDate && t.status !== "DONE" && t.status !== "CANCELLED")

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))

  return (
    <div className="space-y-6">
      {/* Month navigator */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-sm font-semibold text-white">
            {MONTHS[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-800">
          {DAYS.map(d => (
            <div key={d} className="text-center text-xs text-gray-600 font-medium py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {gridCells.map((day, i) => {
            if (!day) {
              return <div key={`blank-${i}`} className="min-h-[80px] border-b border-r border-gray-800/50" />
            }
            const dayTasks = getTasksForDay(day)
            const isToday = isSameDay(day, today)
            const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
            const isPast = startOfDay(day) < startOfDay(today)
            const hasOverdue = dayTasks.some(t => t.status !== "DONE" && t.status !== "CANCELLED")

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={`min-h-[80px] p-2 text-left border-b border-r border-gray-800/50 transition-colors relative
                  ${isSelected ? "bg-gray-800" : "hover:bg-gray-800/50"}
                  ${i % 7 === 6 ? "border-r-0" : ""}
                `}
              >
                <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1
                  ${isToday ? "bg-blue-600 text-white" : isPast && hasOverdue && dayTasks.length > 0 ? "text-red-400" : "text-gray-400"}
                `}>
                  {day.getDate()}
                </span>
                <div className="flex flex-wrap gap-0.5">
                  {dayTasks.slice(0, 3).map(t => (
                    <div
                      key={t.id}
                      className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[t.priority] ?? "bg-gray-600"} ${t.status === "DONE" ? "opacity-40" : ""}`}
                    />
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="text-xs text-gray-600 leading-none">+{dayTasks.length - 3}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day panel */}
      {selectedDay && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              {selectedDay.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </h3>
            <span className="text-xs text-gray-500">
              {selectedTasks.length} task{selectedTasks.length !== 1 ? "s" : ""}
            </span>
          </div>
          {selectedTasks.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-gray-600 text-sm">No tasks due this day</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {selectedTasks.map(t => (
                <Link
                  key={t.id}
                  href={`/dashboard/tasks/${t.id}`}
                  className={`flex items-start gap-3 px-5 py-3.5 hover:bg-gray-800/50 transition-colors border-l-2 ${PRIORITY_BORDER[t.priority] ?? "border-l-gray-700"}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${t.status === "DONE" ? "text-gray-500 line-through" : "text-white"}`}>
                      {t.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs ${CATEGORY_COLOURS[t.category] ?? "text-gray-500"}`}>
                        {t.category}
                      </span>
                      <span className="text-xs text-gray-700">·</span>
                      <span className="text-xs text-gray-600 capitalize">{t.status.replace("_", " ").toLowerCase()}</span>
                    </div>
                  </div>
                  <svg className="w-3.5 h-3.5 text-gray-700 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No due date tasks */}
      {noDueDateTasks.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-gray-400">No due date · {noDueDateTasks.length}</h3>
          </div>
          <div className="divide-y divide-gray-800">
            {noDueDateTasks.map(t => (
              <Link
                key={t.id}
                href={`/dashboard/tasks/${t.id}`}
                className={`flex items-start gap-3 px-5 py-3 hover:bg-gray-800/50 transition-colors border-l-2 ${PRIORITY_BORDER[t.priority] ?? "border-l-gray-700"}`}
              >
                <p className="text-sm text-gray-400 flex-1 truncate">{t.title}</p>
                <span className={`text-xs ${CATEGORY_COLOURS[t.category] ?? "text-gray-500"}`}>{t.category}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
