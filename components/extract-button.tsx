"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface ExtractResult {
  ok: boolean
  processed?: number
  errors?: number
  error?: string
}

export function ExtractButton() {
  const router = useRouter()
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [result, setResult] = useState<ExtractResult | null>(null)

  const handleExtract = async () => {
    setState("loading")
    setResult(null)
    try {
      const res = await fetch("/api/ai/extract", { method: "POST" })
      const data: ExtractResult = await res.json()
      setResult(data)
      setState(data.error ? "error" : "done")
      router.refresh()
    } catch {
      setState("error")
      setResult({ ok: false, error: "Network error" })
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleExtract}
        disabled={state === "loading"}
        className="flex items-center gap-2 bg-purple-700 hover:bg-purple-600 disabled:bg-purple-900 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-150"
      >
        {state === "loading" ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Extracting…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.346.346a.5.5 0 01-.353.147H9.172a.5.5 0 01-.353-.147l-.345-.346z" />
            </svg>
            Run AI extraction
          </>
        )}
      </button>

      {state === "done" && result && (
        <p className="text-xs text-purple-400">
          ✓ {result.processed} email{result.processed !== 1 ? "s" : ""} processed
          {result.errors ? ` · ${result.errors} error${result.errors !== 1 ? "s" : ""}` : ""}
        </p>
      )}
      {state === "error" && result && (
        <p className="text-xs text-red-400">✗ {result.error}</p>
      )}
    </div>
  )
}
