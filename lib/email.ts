import { getAccessToken } from "@/lib/graph"

const GRAPH_BASE = "https://graph.microsoft.com/v1.0"

export async function sendReminderEmail(
  userId: string,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const token = await getAccessToken(userId)
  if (!token) throw new Error("No access token — user may need to re-authenticate")

  const res = await fetch(`${GRAPH_BASE}/me/sendMail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "HTML", content: html },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: false,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Graph sendMail ${res.status}: ${err}`)
  }
}

// ─── Email templates ──────────────────────────────────────────────────────────

export function buildReminderHtml(opts: {
  taskTitle: string
  priority: string
  dueLabel: string
  amount: string | null
  appUrl: string
  taskId: string
}): string {
  const priorityColour: Record<string, string> = {
    URGENT: "#ef4444",
    HIGH:   "#f97316",
    MEDIUM: "#eab308",
    LOW:    "#6b7280",
  }
  const colour = priorityColour[opts.priority] ?? "#6b7280"

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:40px auto;padding:0 16px;">
    <div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:32px;">

      <div style="width:44px;height:44px;background:#1d4ed8;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:20px;">
        <span style="font-size:22px;">📋</span>
      </div>

      <p style="margin:0 0 6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">
        Task reminder
      </p>
      <h1 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#f1f5f9;line-height:1.3;">
        ${opts.taskTitle}
      </h1>

      <div style="background:#0f172a;border-radius:10px;padding:16px;margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span style="font-size:13px;color:#64748b;">Due</span>
          <span style="font-size:13px;font-weight:600;color:#f1f5f9;">${opts.dueLabel}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:${opts.amount ? "8px" : "0"}">
          <span style="font-size:13px;color:#64748b;">Priority</span>
          <span style="font-size:12px;font-weight:700;color:${colour};background:${colour}22;border:1px solid ${colour}55;padding:2px 10px;border-radius:999px;">
            ${opts.priority}
          </span>
        </div>
        ${opts.amount ? `
        <div style="display:flex;justify-content:space-between;">
          <span style="font-size:13px;color:#64748b;">Amount</span>
          <span style="font-size:13px;font-weight:600;color:#4ade80;">${opts.amount}</span>
        </div>` : ""}
      </div>

      <a href="${opts.appUrl}/dashboard/tasks/${opts.taskId}"
         style="display:block;text-align:center;background:#1d4ed8;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none;">
        View task →
      </a>
    </div>
    <p style="text-align:center;font-size:11px;color:#334155;margin-top:16px;">
      MailQuark · sent from your Outlook account
    </p>
  </div>
</body>
</html>`
}
