"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export interface TaskItem {
  id: string
  title: string
  description: string | null
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW"
  category: string
  dueDate: string | null
  tags: string[]
  amount: string | null
  assigneeName: string | null
  emailFrom: string | null
  emailSubject: string | null
  createdAt: string
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
  FINANCE: "Finance", LEGAL: "Legal", BOARD: "Board", HR: "HR",
  INVESTORS: "Investors", OPERATIONS: "Ops", PERSONAL: "Personal", OTHER: "Other",
}

const PRIORITY_STYLES: Record<string, string> = {
  URGENT: "bg-red-900/60 text-red-300 border border-red-700",
  HIGH:   "bg-orange-900/60 text-orange-300 border border-orange-700",
  MEDIUM: "bg-yellow-900/40 text-yellow-300 border border-yellow-700",
  LOW:    "bg-gray-800 text-gray-400 border border-gray-700",
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  const today = new Date()
  const diffDays = Math.ceil((d.getTime() - today.setHours(0,0,0,0)) / 86400000)
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Tomorrow"
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(d)
}

function dueDateColour(iso: string | null): string {
  if (!iso) return "text-gray-500"
  const diffDays = Math.ceil((new Date(iso).getTime() - new Date().setHours(0,0,0,0)) / 86400000)
  if (diffDays < 0) return "text-red-400"
  if (diffDays <= 2) return "text-orange-400"
  if (diffDays <= 7) return "text-yellow-400"
  return "text-blue-400"
}

export function TaskCard({ task }: { task: TaskItem }) {
  const router = useRouter()
  const [state, setState] = useState<"idle" | "completing" | "done">("idle")

  const complete = async () => {
    setState("completing")
    await fetch(`/api/tasks/${task.id}/complete`, { method: "POST" })
    setState("done")
    router.refresh()
  }

  if (state === "done") return null

  const dueLabel = fmtDate(task.dueDate)
  const dueColour = dueDateColour(task.dueDate)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3 group">
      {/* Priority + category + due date row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${PRIORITY_STYLES[task.priority]}`}>
            {task.priority}
          </span>
          {task.category && task.category !== "OTHER" && (
            <span className={`text-xs border px-2 py-0.5 rounded-full flex-shrink-0 ${CATEGORY_COLOURS[task.category] ?? CATEGORY_COLOURS.OTHER}`}>
              {CATEGORY_LABELS[task.category] ?? task.category}
            </span>
          )}
        </div>
        {dueLabel && (
          <span className={`text-xs flex items-center gap-1 flex-shrink-0 ${dueColour}`}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {dueLabel}
          </span>
        )}
      </div>

      {/* Title */}
      <p className="text-white font-semibold leading-snug">{task.title}</p>

      {/* Description */}
      {task.description && (
        <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{task.description}</p>
      )}

      {/* Meta chips */}
      {(task.amount || task.assigneeName) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {task.amount && (
            <span className="bg-green-900/40 text-green-300 border border-green-800 px-2 py-0.5 rounded-full">
              {task.amount}
            </span>
          )}
          {task.assigneeName && (
            <span className="bg-purple-900/40 text-purple-300 border border-purple-800 px-2 py-0.5 rounded-full">
              @{task.assigneeName}
            </span>
          )}
        </div>
      )}

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {task.tags.map(tag => (
            <span key={tag} className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700/50">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Email origin */}
      {task.emailFrom && (
        <p className="text-xs text-gray-600">
          From: <span className="text-gray-500">{task.emailFrom}</span>
        </p>
      )}

      {/* Actions row */}
      <div className="flex gap-2">
        <button
          onClick={complete}
          disabled={state !== "idle"}
          className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 hover:text-white text-sm font-medium py-2 rounded-lg transition-colors border border-gray-700 hover:border-gray-600"
        >
          {state === "completing" ? (
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Done
            </>
          )}
        </button>
        <Link
          href={`/dashboard/tasks/${task.id}`}
          className="px-4 flex items-center justify-center text-gray-500 hover:text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700 hover:border-gray-600 text-sm"
        >
          Edit
        </Link>
      </div>
    </div>
  )
}
