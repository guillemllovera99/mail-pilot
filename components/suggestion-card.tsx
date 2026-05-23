"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface Suggestion {
  id: string
  emailSubject: string | null
  emailFrom: string | null
  emailReceivedAt: string | null
  suggestedTitle: string
  suggestedDescription: string | null
  suggestedPriority: "URGENT" | "HIGH" | "MEDIUM" | "LOW"
  suggestedDueDate: string | null
  suggestedTags: string[]
  suggestedAmount: string | null
  suggestedAssignee: string | null
  confidence: number
}

const PRIORITY_STYLES: Record<string, string> = {
  URGENT: "bg-red-900/60 text-red-300 border border-red-700",
  HIGH: "bg-orange-900/60 text-orange-300 border border-orange-700",
  MEDIUM: "bg-yellow-900/40 text-yellow-300 border border-yellow-700",
  LOW: "bg-gray-800 text-gray-400 border border-gray-700",
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(iso))
}

export function SuggestionCard({ s }: { s: Suggestion }) {
  const router = useRouter()
  const [state, setState] = useState<"idle" | "approving" | "dismissing" | "done">("idle")

  const act = async (action: "approve" | "dismiss") => {
    setState(action === "approve" ? "approving" : "dismissing")
    try {
      await fetch(`/api/suggestions/${s.id}/${action}`, { method: "POST" })
      setState("done")
      router.refresh()
    } catch {
      setState("idle")
    }
  }

  if (state === "done") return null

  const received = fmtDate(s.emailReceivedAt)
  const dueDate = fmtDate(s.suggestedDueDate)
  const confidencePct = Math.round(s.confidence * 100)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_STYLES[s.suggestedPriority]}`}>
          {s.suggestedPriority}
        </span>
        <span className="text-xs text-gray-600">{confidencePct}% confidence</span>
      </div>

      <p className="text-white font-semibold leading-snug">{s.suggestedTitle}</p>

      <div className="text-xs text-gray-500 space-y-0.5">
        {s.emailFrom && <p>From: <span className="text-gray-400">{s.emailFrom}</span></p>}
        {s.emailSubject && s.emailSubject !== s.suggestedTitle && (
          <p>Subject: <span className="text-gray-400 italic">{s.emailSubject}</span></p>
        )}
        {received && <p>Received: {received}</p>}
      </div>

      {(dueDate || s.suggestedAmount || s.suggestedAssignee) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {dueDate && (
            <span className="flex items-center gap-1 bg-blue-900/40 text-blue-300 border border-blue-800 px-2 py-0.5 rounded-full">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Due {dueDate}
            </span>
          )}
          {s.suggestedAmount && (
            <span className="bg-green-900/40 text-green-300 border border-green-800 px-2 py-0.5 rounded-full">
              {s.suggestedAmount}
            </span>
          )}
          {s.suggestedAssignee && (
            <span className="bg-purple-900/40 text-purple-300 border border-purple-800 px-2 py-0.5 rounded-full">
              @{s.suggestedAssignee}
            </span>
          )}
        </div>
      )}

      {s.suggestedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {s.suggestedTags.map(tag => (
            <span key={tag} className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => act("approve")}
          disabled={state !== "idle"}
          className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white text-sm font-medium py-2 rounded-lg transition-colors"
        >
          {state === "approving" ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Add as task
            </>
          )}
        </button>
        <button
          onClick={() => act("dismiss")}
          disabled={state !== "idle"}
          className="px-3 flex items-center justify-center text-gray-500 hover:text-gray-300 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg transition-colors"
        >
          {state === "dismissing" ? (
            <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
