"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface SyncResult {
  ok: boolean
  synced?: number
  skipped?: number
  error?: string
}

export function SyncButton({ onDone, compact }: { onDone?: () => void; compact?: boolean }) {
  const router = useRouter()
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [result, setResult] = useState<SyncResult | null>(null)

  const handleSync = async () => {
    setState("loading")
    setResult(null)
    try {
      const res = await fetch("/api/sync/trigger", { method: "POST" })
      const data: SyncResult = await res.json()
      setResult(data)
      setState(data.error ? "error" : "done")
      onDone?.()
      router.refresh()
      setTimeout(() => setState("idle"), 3000)
    } catch {
      setState("error")
      setResult({ ok: false, error: "Network error" })
      setTimeout(() => setState("idle"), 3000)
    }
  }

  if (compact) {
    return (
      <button
        onClick={handleSync}
        disabled={state === "loading"}
        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 text-gray-300 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
      >
        {state === "loading" ? (
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className={`w-4 h-4 ${state === "done" ? "text-green-400" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {state === "done"
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            }
          </svg>
        )}
        {state === "loading" ? "Syncing…" : state === "done" ? "Synced" : "Sync inbox"}
      </button>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleSync}
        disabled={state === "loading"}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-150"
      >
        {state === "loading" ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Syncing…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync inbox now
          </>
        )}
      </button>
      {state === "done" && result && (
        <p className="text-xs text-green-400">✓ {result.synced} new emails synced</p>
      )}
      {state === "error" && result && (
        <p className="text-xs text-red-400">✗ {result.error}</p>
      )}
    </div>
  )
}
