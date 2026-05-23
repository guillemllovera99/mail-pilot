"use client"

import { useState, useCallback } from "react"
import Link from "next/link"

export interface KanbanTask {
  id: string
  title: string
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW"
  status: "OPEN" | "IN_PROGRESS" | "WAITING" | "DONE"
  category: string
  dueDate: string | null
  emailFrom: string | null
  amount: string | null
}

const COLUMNS: { key: KanbanTask["status"]; label: string; colour: string; headerColour: string }[] = [
  { key: "OPEN",        label: "Open",        colour: "border-gray-700",   headerColour: "text-gray-400" },
  { key: "IN_PROGRESS", label: "In progress", colour: "border-blue-800",   headerColour: "text-blue-400" },
  { key: "WAITING",     label: "Waiting",     colour: "border-yellow-800", headerColour: "text-yellow-400" },
  { key: "DONE",        label: "Done",        colour: "border-green-900",  headerColour: "text-green-400" },
]

const PRIORITY_DOT: Record<string, string> = {
  URGENT: "bg-red-500", HIGH: "bg-orange-500", MEDIUM: "bg-yellow-500", LOW: "bg-gray-600",
}

const CATEGORY_COLOURS: Record<string, string> = {
  FINANCE: "text-green-400 border-green-800",
  LEGAL: "text-purple-400 border-purple-800",
  BOARD: "text-blue-400 border-blue-800",
  HR: "text-pink-400 border-pink-800",
  INVESTORS: "text-yellow-400 border-yellow-800",
  OPERATIONS: "text-orange-400 border-orange-800",
  PERSONAL: "text-gray-400 border-gray-700",
  OTHER: "text-gray-500 border-gray-700",
}

const CATEGORY_LABELS: Record<string, string> = {
  FINANCE: "Finance", LEGAL: "Legal", BOARD: "Board",
  HR: "HR", INVESTORS: "Investors", OPERATIONS: "Ops",
  PERSONAL: "Personal", OTHER: "Other",
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  const diff = Math.ceil((d.getTime() - new Date().setHours(0,0,0,0)) / 86400000)
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, colour: "text-red-400" }
  if (diff === 0) return { label: "Today", colour: "text-orange-400" }
  if (diff === 1) return { label: "Tomorrow", colour: "text-yellow-400" }
  return { label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d), colour: "text-gray-500" }
}

export function KanbanBoard({ initialTasks }: { initialTasks: KanbanTask[] }) {
  const [tasks, setTasks] = useState(initialTasks)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [saving, setSaving] = useState<Set<string>>(new Set())

  const getColumn = (status: string) => tasks.filter(t => t.status === status)

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId)
    setDraggingId(taskId)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setDragOverCol(null)
  }

  const handleDrop = useCallback(async (e: React.DragEvent, newStatus: KanbanTask["status"]) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData("taskId")
    const task = tasks.find(t => t.id === taskId)
    if (!task || task.status === newStatus) return

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    setDragOverCol(null)

    setSaving(prev => new Set(prev).add(taskId))
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
    } catch {
      // Revert on error
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t))
    } finally {
      setSaving(prev => { const s = new Set(prev); s.delete(taskId); return s })
    }
  }, [tasks])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {COLUMNS.map(col => {
        const colTasks = getColumn(col.key)
        const isOver = dragOverCol === col.key
        return (
          <div
            key={col.key}
            onDragOver={e => { e.preventDefault(); setDragOverCol(col.key) }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={e => handleDrop(e, col.key)}
            className={`flex flex-col gap-2 min-h-[200px] rounded-2xl p-3 border transition-colors ${
              isOver ? "bg-gray-800/60 border-blue-700" : `bg-gray-900/40 ${col.colour}`
            }`}
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-1 mb-1">
              <span className={`text-xs font-semibold uppercase tracking-wider ${col.headerColour}`}>
                {col.label}
              </span>
              <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">
                {colTasks.length}
              </span>
            </div>

            {/* Cards */}
            {colTasks.map(task => {
              const due = fmtDate(task.dueDate)
              const isSaving = saving.has(task.id)
              const isDragging = draggingId === task.id
              return (
                <div
                  key={task.id}
                  draggable
                  onDragStart={e => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                  className={`bg-gray-900 border border-gray-800 rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all select-none ${
                    isDragging ? "opacity-40 scale-95" : "hover:border-gray-700"
                  } ${isSaving ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority]}`} />
                      <span className={`text-xs border px-1.5 py-0 rounded-full ${CATEGORY_COLOURS[task.category] ?? CATEGORY_COLOURS.OTHER}`}>
                        {CATEGORY_LABELS[task.category] ?? "Other"}
                      </span>
                    </div>
                    <Link
                      href={`/dashboard/tasks/${task.id}`}
                      onClick={e => e.stopPropagation()}
                      className="text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </Link>
                  </div>

                  <p className="text-sm text-white font-medium leading-snug line-clamp-2">{task.title}</p>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    {due && (
                      <span className={`text-xs ${due.colour}`}>{due.label}</span>
                    )}
                    {task.amount && (
                      <span className="text-xs text-green-400 ml-auto">{task.amount}</span>
                    )}
                  </div>

                  {task.emailFrom && (
                    <p className="text-xs text-gray-600 truncate mt-1">{task.emailFrom}</p>
                  )}
                </div>
              )
            })}

            {colTasks.length === 0 && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-gray-700">Drop tasks here</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
