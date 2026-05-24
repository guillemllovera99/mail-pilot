"use client"

import { useState, useRef, useTransition } from "react"
import { useRouter } from "next/navigation"

interface Comment {
  id: string
  content: string
  createdAt: string
}

interface Task {
  id: string
  title: string
  description: string | null
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW"
  status: "OPEN" | "IN_PROGRESS" | "WAITING" | "DONE" | "CANCELLED"
  dueDate: string | null
  completedAt: string | null
  tags: string[]
  amount: string | null
  assigneeName: string | null
  emailFrom: string | null
  emailSubject: string | null
  emailBody: string | null
  recurrenceRule: string
  attachmentUrls: string[]
  createdAt: string
  comments: Comment[]
}

const RECURRENCE_LABELS: Record<string, string> = {
  NONE: "No recurrence",
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
}

const PRIORITY_COLOURS: Record<string, string> = {
  URGENT: "text-red-400 bg-red-900/40 border-red-800",
  HIGH:   "text-orange-400 bg-orange-900/40 border-orange-800",
  MEDIUM: "text-yellow-400 bg-yellow-900/40 border-yellow-800",
  LOW:    "text-gray-400 bg-gray-800 border-gray-700",
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  WAITING: "Waiting",
  DONE: "Done",
  CANCELLED: "Cancelled",
}

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium", timeStyle: "short",
  }).format(new Date(iso))
}

function toDateInput(iso: string | null): string {
  if (!iso) return ""
  return iso.split("T")[0]
}

export function TaskEditor({ task: initial }: { task: Task }) {
  const router = useRouter()
  const [task, setTask] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [noteText, setNoteText] = useState("")
  const [addingNote, setAddingNote] = useState(false)
  const [comments, setComments] = useState(initial.comments)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const [reminderDate, setReminderDate] = useState("")
  const [reminderState, setReminderState] = useState<"idle" | "saving" | "saved">("idle")
  const [, startTransition] = useTransition()
  const [emailBodyOpen, setEmailBodyOpen] = useState(false)
  const [attachmentUrl, setAttachmentUrl] = useState("")
  const [addingAttachment, setAddingAttachment] = useState(false)

  const patch = async (changes: Partial<Task>) => {
    setSaving(true)
    const updated = { ...task, ...changes }
    setTask(updated)
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    })
    setSaving(false)
    router.refresh()
  }

  const addNote = async () => {
    if (!noteText.trim()) return
    setAddingNote(true)
    const res = await fetch(`/api/tasks/${task.id}/note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: noteText.trim() }),
    })
    const data = await res.json()
    if (data.ok) {
      setComments(prev => [...prev, data.comment])
      setNoteText("")
    }
    setAddingNote(false)
  }

  const isDone = task.status === "DONE"

  const addAttachment = async () => {
    const url = attachmentUrl.trim()
    if (!url) return
    setAddingAttachment(true)
    const newUrls = [...task.attachmentUrls, url]
    setTask(t => ({ ...t, attachmentUrls: newUrls }))
    setAttachmentUrl("")
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentUrls: newUrls }),
    })
    setAddingAttachment(false)
  }

  const removeAttachment = async (url: string) => {
    const newUrls = task.attachmentUrls.filter(u => u !== url)
    setTask(t => ({ ...t, attachmentUrls: newUrls }))
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentUrls: newUrls }),
    })
  }

  const setReminder = async () => {
    if (!reminderDate) return
    setReminderState("saving")
    // Set reminder at 9am on the chosen date
    const remindAt = new Date(reminderDate)
    remindAt.setHours(9, 0, 0, 0)
    await fetch(`/api/tasks/${task.id}/remind`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remindAt: remindAt.toISOString() }),
    })
    setReminderState("saved")
    setReminderDate("")
    startTransition(() => { setTimeout(() => setReminderState("idle"), 3000) })
  }

  return (
    <div className="space-y-5">
      {/* Status bar */}
      <div className="flex items-center justify-between gap-3">
        <select
          value={task.status}
          onChange={e => patch({ status: e.target.value as Task["status"] })}
          className="text-xs font-medium bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-gray-500"
        >
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <span className="text-xs text-gray-600">
          {saving ? "Saving…" : `Updated ${fmtDateTime(task.createdAt)}`}
        </span>
      </div>

      {/* Main card */}
      <div className={`bg-gray-900 border rounded-2xl p-6 space-y-5 ${isDone ? "border-green-900/50 opacity-70" : "border-gray-800"}`}>

        {/* Title */}
        <div>
          <label className="text-xs text-gray-500 font-medium uppercase tracking-wider">Task</label>
          <textarea
            defaultValue={task.title}
            onBlur={e => {
              if (e.target.value.trim() !== task.title) patch({ title: e.target.value.trim() })
            }}
            rows={2}
            className="mt-1 w-full bg-transparent text-white font-semibold text-lg leading-snug resize-none focus:outline-none focus:ring-1 focus:ring-gray-600 rounded-lg p-1 -m-1"
            placeholder="Task title…"
          />
        </div>

        {/* Priority + Due date row */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[120px]">
            <label className="text-xs text-gray-500 font-medium uppercase tracking-wider">Priority</label>
            <select
              value={task.priority}
              onChange={e => patch({ priority: e.target.value as Task["priority"] })}
              className={`mt-1 w-full text-xs font-semibold border rounded-lg px-3 py-2 focus:outline-none ${PRIORITY_COLOURS[task.priority]}`}
            >
              <option value="URGENT">URGENT</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-gray-500 font-medium uppercase tracking-wider">Due date</label>
            <input
              type="date"
              defaultValue={toDateInput(task.dueDate)}
              onBlur={e => patch({ dueDate: e.target.value || null })}
              className="mt-1 w-full bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-gray-500"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs text-gray-500 font-medium uppercase tracking-wider">Description</label>
          <textarea
            defaultValue={task.description ?? ""}
            onBlur={e => {
              const val = e.target.value.trim() || null
              if (val !== task.description) patch({ description: val })
            }}
            rows={3}
            placeholder="Add more context…"
            className="mt-1 w-full bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-gray-500 placeholder-gray-600"
          />
        </div>

        {/* Meta */}
        {(task.amount || task.assigneeName || task.emailFrom) && (
          <div className="space-y-1.5 pt-1 border-t border-gray-800">
            {task.amount && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Amount</span>
                <span className="text-green-400 font-medium">{task.amount}</span>
              </div>
            )}
            {task.assigneeName && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Contact</span>
                <span className="text-gray-300">@{task.assigneeName}</span>
              </div>
            )}
            {task.emailFrom && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">From</span>
                <span className="text-gray-400 text-xs truncate max-w-[220px]">{task.emailFrom}</span>
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {task.tags.map(tag => (
              <span key={tag} className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Mark done / reopen */}
        {!isDone ? (
          <button
            onClick={() => patch({ status: "DONE" })}
            className="w-full flex items-center justify-center gap-2 bg-green-900/40 hover:bg-green-900/60 border border-green-800 text-green-400 text-sm font-medium py-2.5 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Mark done
          </button>
        ) : (
          <button
            onClick={() => patch({ status: "OPEN" })}
            className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 text-sm font-medium py-2.5 rounded-xl transition-colors"
          >
            Reopen task
          </button>
        )}
      </div>

      {/* Reminder */}
      {!isDone && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Reminder</p>
          <p className="text-xs text-gray-600">You'll receive an email reminder at 9am on the chosen date.</p>
          <div className="flex gap-2">
            <input
              type="date"
              value={reminderDate}
              onChange={e => setReminderDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="flex-1 bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-gray-500"
            />
            <button
              onClick={setReminder}
              disabled={!reminderDate || reminderState === "saving"}
              className="px-4 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-300 text-sm font-medium rounded-xl transition-colors"
            >
              {reminderState === "saving" ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : reminderState === "saved" ? "✓ Set!" : "Set"}
            </button>
          </div>
        </div>
      )}

      {/* Email body */}
      {task.emailBody && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-3">
          <button
            onClick={() => setEmailBodyOpen(o => !o)}
            className="flex items-center justify-between w-full text-left"
          >
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Original email</p>
            <svg className={`w-4 h-4 text-gray-600 transition-transform ${emailBodyOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {emailBodyOpen && (
            <p className="text-gray-500 text-xs leading-relaxed whitespace-pre-wrap border-t border-gray-800 pt-3">
              {task.emailBody}
            </p>
          )}
        </div>
      )}

      {/* Recurrence */}
      {!isDone && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recurrence</p>
          <select
            value={task.recurrenceRule ?? "NONE"}
            onChange={e => {
              const val = e.target.value
              setTask(t => ({ ...t, recurrenceRule: val }))
              fetch(`/api/tasks/${task.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ recurrenceRule: val }),
              })
            }}
            className="w-full bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-gray-500"
          >
            {Object.entries(RECURRENCE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          {task.recurrenceRule && task.recurrenceRule !== "NONE" && (
            <p className="text-xs text-gray-600">
              When marked done, a new task will auto-create with the next due date.
            </p>
          )}
        </div>
      )}

      {/* Attachments */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Links &amp; Attachments</p>

        {task.attachmentUrls.length > 0 && (
          <div className="space-y-2">
            {task.attachmentUrls.map(url => (
              <div key={url} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
                <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-xs text-blue-400 hover:text-blue-300 truncate"
                >
                  {url}
                </a>
                <button
                  onClick={() => removeAttachment(url)}
                  className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="url"
            value={attachmentUrl}
            onChange={e => setAttachmentUrl(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addAttachment() }}
            placeholder="Paste a link (Drive, Dropbox, …)"
            className="flex-1 bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-gray-500 placeholder-gray-600"
          />
          <button
            onClick={addAttachment}
            disabled={!attachmentUrl.trim() || addingAttachment}
            className="px-4 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-300 text-sm font-medium rounded-xl transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</p>

        {comments.length === 0 && (
          <p className="text-gray-600 text-sm">No notes yet.</p>
        )}

        <div className="space-y-3">
          {comments.map(c => (
            <div key={c.id} className="bg-gray-800 rounded-xl px-4 py-3">
              <p className="text-gray-300 text-sm whitespace-pre-wrap">{c.content}</p>
              <p className="text-gray-600 text-xs mt-1.5">{fmtDateTime(c.createdAt)}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <textarea
            ref={noteRef}
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            rows={2}
            placeholder="Add a note…"
            className="w-full bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-gray-500 placeholder-gray-600"
          />
          <button
            onClick={addNote}
            disabled={!noteText.trim() || addingNote}
            className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-300 text-sm font-medium py-2 rounded-xl transition-colors"
          >
            {addingNote ? (
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : "Add note"}
          </button>
        </div>
      </div>
    </div>
  )
}
