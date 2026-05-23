"use client"

import { useEffect, useState, useCallback } from "react"

interface Task {
  id: string
  title: string
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW"
  status: string
  category: string
  dueDate: string | null
  amount: string | null
}

interface Suggestion {
  id: string
  emailSubject: string
  emailFrom: string
  suggestedTitle: string
  suggestedPriority: string
  suggestedCategory: string
  confidence: number
}

const PRIORITY_DOT: Record<string, string> = {
  URGENT: "#ef4444", HIGH: "#f97316", MEDIUM: "#eab308", LOW: "#6b7280",
}
const PRIORITY_BG: Record<string, string> = {
  URGENT: "rgba(239,68,68,0.15)", HIGH: "rgba(249,115,22,0.15)",
  MEDIUM: "rgba(234,179,8,0.15)", LOW: "rgba(107,114,128,0.15)",
}
const CATEGORY_COLOUR: Record<string, string> = {
  FINANCE: "#4ade80", LEGAL: "#c084fc", BOARD: "#60a5fa",
  HR: "#f472b6", INVESTORS: "#facc15", OPERATIONS: "#fb923c",
  PERSONAL: "#9ca3af", OTHER: "#6b7280",
}
const CATEGORY_LABELS: Record<string, string> = {
  FINANCE: "Finance", LEGAL: "Legal", BOARD: "Board", HR: "HR",
  INVESTORS: "Investors", OPERATIONS: "Ops", PERSONAL: "Personal", OTHER: "Other",
}

function PriorityDot({ p }: { p: string }) {
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: PRIORITY_DOT[p] ?? "#6b7280", flexShrink: 0,
    }} />
  )
}

export default function OutlookTaskpane() {
  const [officeReady, setOfficeReady] = useState(false)
  const [notInOutlook, setNotInOutlook] = useState(false)
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [emailSubject, setEmailSubject] = useState("")
  const [emailFrom, setEmailFrom] = useState("")
  const [tasks, setTasks] = useState<Task[]>([])
  const [openTasks, setOpenTasks] = useState<Task[]>([])
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionState, setActionState] = useState<"idle" | "working" | "done" | "error">("idle")
  const [actionMsg, setActionMsg] = useState("")
  const [tab, setTab] = useState<"email" | "tasks">("email")

  // Check auth on mount
  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then(r => r.json())
      .then(s => setAuthenticated(!!s?.user?.id))
      .catch(() => setAuthenticated(false))
  }, [])

  // Load Office.js
  useEffect(() => {
    const script = document.createElement("script")
    script.src = "https://appsforoffice.microsoft.com/lib/1/hosted/office.js"
    script.async = true
    script.onload = () => {
      const win = window as any
      if (!win.Office) { setNotInOutlook(true); setLoading(false); return }
      win.Office.onReady((info: any) => {
        setOfficeReady(true)
        const item = win.Office.context?.mailbox?.item
        if (!item) { setNotInOutlook(true); setLoading(false); return }
        const subject = item.subject ?? ""
        const from = item.from?.emailAddress ?? item.sender?.emailAddress ?? ""
        setEmailSubject(subject)
        setEmailFrom(from)
      })
    }
    script.onerror = () => { setNotInOutlook(true); setLoading(false) }
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [])

  const fetchContext = useCallback(async (subject: string, from: string) => {
    if (!subject && !from) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ subject, from })
      const res = await fetch(`/api/outlook/context?${params}`, { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setTasks(data.tasks ?? [])
        setSuggestion(data.suggestion ?? null)
        setOpenTasks(data.openTasks ?? [])
      }
    } catch {}
    setLoading(false)
  }, [])

  // Fetch context once Office is ready and auth confirmed
  useEffect(() => {
    if (officeReady && authenticated && emailSubject) {
      fetchContext(emailSubject, emailFrom)
    } else if (officeReady && authenticated && !emailSubject) {
      // No email selected, just load open tasks
      fetch("/api/outlook/context?subject=&from=", { credentials: "include" })
        .then(r => r.json())
        .then(d => { setOpenTasks(d.openTasks ?? []); setLoading(false) })
        .catch(() => setLoading(false))
    }
  }, [officeReady, authenticated, emailSubject, emailFrom, fetchContext])

  const handleApprove = async () => {
    if (!suggestion) return
    setActionState("working")
    try {
      const res = await fetch(`/api/suggestions/${suggestion.id}/approve`, {
        method: "POST",
        credentials: "include",
      })
      if (res.ok) {
        setActionMsg("✓ Task created")
        setActionState("done")
        setSuggestion(null)
        fetchContext(emailSubject, emailFrom)
      } else {
        setActionMsg("Failed to create task")
        setActionState("error")
      }
    } catch {
      setActionMsg("Network error")
      setActionState("error")
    }
    setTimeout(() => setActionState("idle"), 3000)
  }

  const handleCreateTask = async () => {
    setActionState("working")
    try {
      const res = await fetch("/api/outlook/create-task", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: emailSubject, from: emailFrom }),
      })
      if (res.ok) {
        setActionMsg("✓ Task created")
        setActionState("done")
        fetchContext(emailSubject, emailFrom)
      } else {
        setActionMsg("Failed")
        setActionState("error")
      }
    } catch {
      setActionMsg("Network error")
      setActionState("error")
    }
    setTimeout(() => setActionState("idle"), 3000)
  }

  const handleDismiss = async () => {
    if (!suggestion) return
    await fetch(`/api/suggestions/${suggestion.id}/dismiss`, { method: "POST", credentials: "include" })
    setSuggestion(null)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const s: React.CSSProperties = {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    background: "#0f172a",
    color: "#f1f5f9",
    minHeight: "100vh",
    fontSize: 13,
  }

  if (authenticated === null || (officeReady && loading)) {
    return (
      <div style={{ ...s, display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 24, height: 24, border: "2px solid #334155", borderTopColor: "#3b82f6",
            borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px",
          }} />
          <p style={{ color: "#64748b", fontSize: 12 }}>Loading…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (authenticated === false) {
    return (
      <div style={{ ...s, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
          <div style={{ width: 28, height: 28, background: "#1d4ed8", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 14 }}>📋</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>MailQuark</span>
        </div>
        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: 20, textAlign: "center" }}>
          <p style={{ color: "#94a3b8", marginBottom: 16, lineHeight: 1.5 }}>
            Sign in to MailQuark to manage tasks from your emails.
          </p>
          <a
            href="https://mail-quark.vercel.app/login"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block", background: "#1d4ed8", color: "#fff",
              padding: "10px 16px", borderRadius: 8, textDecoration: "none",
              fontWeight: 600, fontSize: 13,
            }}
          >
            Sign in to MailQuark →
          </a>
          <p style={{ color: "#475569", fontSize: 11, marginTop: 12 }}>
            After signing in, close this panel and reopen it.
          </p>
        </div>
      </div>
    )
  }

  if (notInOutlook && !officeReady) {
    return (
      <div style={{ ...s, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
          <div style={{ width: 28, height: 28, background: "#1d4ed8", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 14 }}>📋</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>MailQuark</span>
        </div>
        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: 20 }}>
          <p style={{ color: "#94a3b8", lineHeight: 1.5, marginBottom: 16 }}>
            This panel is designed to run inside Outlook. Open any email to see related tasks.
          </p>
          <a
            href="https://mail-quark.vercel.app/dashboard"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block", background: "#1e293b", border: "1px solid #334155",
              color: "#94a3b8", padding: "8px 16px", borderRadius: 8,
              textDecoration: "none", textAlign: "center", fontSize: 12,
            }}
          >
            Open full dashboard →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={s}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderBottom: "1px solid #1e293b", background: "#0f172a",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, background: "#1d4ed8", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 12 }}>📋</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>MailQuark</span>
        </div>
        <a
          href="https://mail-quark.vercel.app/dashboard"
          target="_blank"
          rel="noreferrer"
          style={{ color: "#475569", fontSize: 11, textDecoration: "none" }}
        >
          Open app ↗
        </a>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #1e293b" }}>
        {(["email", "tasks"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: "10px 0", fontSize: 12, fontWeight: 600,
              background: "transparent", border: "none", cursor: "pointer",
              borderBottom: tab === t ? "2px solid #3b82f6" : "2px solid transparent",
              color: tab === t ? "#f1f5f9" : "#64748b",
              textTransform: "capitalize",
            }}
          >
            {t === "email" ? "This Email" : `Open Tasks (${openTasks.length})`}
          </button>
        ))}
      </div>

      <div style={{ padding: 16, overflowY: "auto", height: "calc(100vh - 95px)" }}>

        {/* ── EMAIL TAB ── */}
        {tab === "email" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Current email info */}
            {emailSubject ? (
              <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: 12 }}>
                <p style={{ color: "#64748b", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                  Current email
                </p>
                <p style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 13, marginBottom: 4, lineHeight: 1.4 }}>
                  {emailSubject}
                </p>
                {emailFrom && (
                  <p style={{ color: "#64748b", fontSize: 11 }}>From: {emailFrom}</p>
                )}
              </div>
            ) : (
              <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: 16, textAlign: "center" }}>
                <p style={{ color: "#64748b", fontSize: 12 }}>Open an email to see related tasks</p>
              </div>
            )}

            {/* Action feedback */}
            {actionState !== "idle" && (
              <div style={{
                background: actionState === "done" ? "rgba(74,222,128,0.1)" : actionState === "error" ? "rgba(239,68,68,0.1)" : "rgba(59,130,246,0.1)",
                border: `1px solid ${actionState === "done" ? "#166534" : actionState === "error" ? "#7f1d1d" : "#1e40af"}`,
                borderRadius: 8, padding: "10px 12px", textAlign: "center",
                color: actionState === "done" ? "#4ade80" : actionState === "error" ? "#f87171" : "#93c5fd",
                fontSize: 12, fontWeight: 600,
              }}>
                {actionState === "working" ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    Working…
                  </span>
                ) : actionMsg}
              </div>
            )}

            {/* AI Suggestion */}
            {suggestion && (
              <div style={{ background: "#1e293b", border: "1px solid #1e40af", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 10 }}>✨</span>
                  <p style={{ color: "#93c5fd", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    AI Suggestion
                  </p>
                  <span style={{
                    marginLeft: "auto", fontSize: 10, color: "#475569",
                    background: "#0f172a", padding: "1px 6px", borderRadius: 4,
                  }}>
                    {Math.round(suggestion.confidence * 100)}% confident
                  </span>
                </div>
                <p style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 13, marginBottom: 8, lineHeight: 1.4 }}>
                  {suggestion.suggestedTitle}
                </p>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  <span style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: 999,
                    background: PRIORITY_BG[suggestion.suggestedPriority] ?? "rgba(107,114,128,0.15)",
                    color: PRIORITY_DOT[suggestion.suggestedPriority] ?? "#6b7280",
                    border: `1px solid ${PRIORITY_DOT[suggestion.suggestedPriority] ?? "#6b7280"}44`,
                    fontWeight: 700,
                  }}>
                    {suggestion.suggestedPriority}
                  </span>
                  <span style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: 999,
                    border: `1px solid ${CATEGORY_COLOUR[suggestion.suggestedCategory] ?? "#6b7280"}44`,
                    color: CATEGORY_COLOUR[suggestion.suggestedCategory] ?? "#6b7280",
                  }}>
                    {CATEGORY_LABELS[suggestion.suggestedCategory] ?? suggestion.suggestedCategory}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={handleApprove}
                    disabled={actionState === "working"}
                    style={{
                      flex: 1, background: "#1d4ed8", color: "#fff", border: "none",
                      borderRadius: 7, padding: "8px 0", fontSize: 12, fontWeight: 600,
                      cursor: "pointer", opacity: actionState === "working" ? 0.6 : 1,
                    }}
                  >
                    ✓ Create task
                  </button>
                  <button
                    onClick={handleDismiss}
                    style={{
                      background: "#0f172a", color: "#64748b", border: "1px solid #334155",
                      borderRadius: 7, padding: "8px 12px", fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Tasks from this sender */}
            {tasks.length > 0 && (
              <div>
                <p style={{ color: "#64748b", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  Tasks from this sender · {tasks.length}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {tasks.map(t => (
                    <a
                      key={t.id}
                      href={`https://mail-quark.vercel.app/dashboard/tasks/${t.id}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 8,
                        background: "#1e293b", border: "1px solid #334155",
                        borderRadius: 8, padding: "10px 12px", textDecoration: "none",
                        borderLeft: `3px solid ${PRIORITY_DOT[t.priority] ?? "#6b7280"}`,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          color: t.status === "DONE" ? "#475569" : "#f1f5f9",
                          fontWeight: 500, fontSize: 12, lineHeight: 1.4,
                          textDecoration: t.status === "DONE" ? "line-through" : "none",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {t.title}
                        </p>
                        <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center" }}>
                          <span style={{ color: CATEGORY_COLOUR[t.category] ?? "#6b7280", fontSize: 10 }}>
                            {CATEGORY_LABELS[t.category] ?? t.category}
                          </span>
                          {t.amount && (
                            <span style={{ color: "#4ade80", fontSize: 10 }}>{t.amount}</span>
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: 9, color: "#475569", flexShrink: 0, marginTop: 2 }}>↗</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Quick create (no suggestion, email is open) */}
            {emailSubject && !suggestion && tasks.length === 0 && !loading && (
              <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: 16, textAlign: "center" }}>
                <p style={{ color: "#64748b", fontSize: 12, marginBottom: 12 }}>
                  No existing tasks for this email.
                </p>
                <button
                  onClick={handleCreateTask}
                  disabled={actionState === "working"}
                  style={{
                    background: "#1e293b", border: "1px solid #334155", color: "#94a3b8",
                    borderRadius: 8, padding: "9px 16px", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", width: "100%",
                    opacity: actionState === "working" ? 0.6 : 1,
                  }}
                >
                  + Create task manually
                </button>
              </div>
            )}

            {emailSubject && !suggestion && tasks.length > 0 && (
              <button
                onClick={handleCreateTask}
                disabled={actionState === "working"}
                style={{
                  background: "transparent", border: "1px solid #334155", color: "#64748b",
                  borderRadius: 8, padding: "9px 16px", fontSize: 12,
                  cursor: "pointer", width: "100%",
                  opacity: actionState === "working" ? 0.6 : 1,
                }}
              >
                + Add another task from this email
              </button>
            )}
          </div>
        )}

        {/* ── TASKS TAB ── */}
        {tab === "tasks" && (
          <div>
            {openTasks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <p style={{ color: "#4ade80", fontSize: 24, marginBottom: 8 }}>✓</p>
                <p style={{ color: "#f1f5f9", fontWeight: 600 }}>All clear!</p>
                <p style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>No open tasks</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {openTasks.map(t => (
                  <a
                    key={t.id}
                    href={`https://mail-quark.vercel.app/dashboard/tasks/${t.id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 8,
                      background: "#1e293b", border: "1px solid #334155",
                      borderRadius: 8, padding: "10px 12px", textDecoration: "none",
                      borderLeft: `3px solid ${PRIORITY_DOT[t.priority] ?? "#6b7280"}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        color: "#f1f5f9", fontWeight: 500, fontSize: 12, lineHeight: 1.4,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {t.title}
                      </p>
                      <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center" }}>
                        <span style={{ color: PRIORITY_DOT[t.priority] ?? "#6b7280", fontSize: 10, fontWeight: 700 }}>
                          {t.priority}
                        </span>
                        <span style={{ color: CATEGORY_COLOUR[t.category] ?? "#6b7280", fontSize: 10 }}>
                          {CATEGORY_LABELS[t.category] ?? t.category}
                        </span>
                        {t.dueDate && (
                          <span style={{ color: "#64748b", fontSize: 10 }}>
                            · {new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                        {t.amount && <span style={{ color: "#4ade80", fontSize: 10 }}>{t.amount}</span>}
                      </div>
                    </div>
                    <span style={{ fontSize: 9, color: "#475569", flexShrink: 0, marginTop: 2 }}>↗</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
