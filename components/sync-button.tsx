"use client"

import { useState } from "react"

interface SyncResult {
  ok: boolean
  synced?: number
  skipped?: number
  error?: string
}

export function SyncButton({ onDone }: { onDone?: () => void }) {
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
    } catch {
      setState("error")
      setResult({ ok: false, error: "Network error" })
    }
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
        <p className="text-xs text-green-400">
          ✓ {result.synced} new emails synced
          {result.skipped ? `, ${result.skipped} already stored` : ""}
        </p>
      )}
      {state === "error" && result && (
        <p className="text-xs text-red-400">✗ {result.error}</p>
      )}
    </div>
  )
}
