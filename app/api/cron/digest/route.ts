export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { sendReminderEmail } from "@/lib/email"

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
const MODEL = "gemini-2.0-flash"

async function generateDigest(data: {
  overdueCount: number
  openCount: number
  completedThisWeek: number
  urgentTasks: { title: string; category: string; dueDate: string | null; amount: string | null }[]
  highTasks: { title: string; category: string; dueDate: string | null; amount: string | null }[]
  completedTasks: { title: string; category: string }[]
  categoryBreakdown: Record<string, number>
}): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) return generateFallbackDigest(data)

  const prompt = `You are a personal assistant writing a concise Monday morning briefing for a CFO.
Write a brief, professional, and actionable HTML email body (no <html>/<body> tags, just inner content).

Data for this week:
- Overdue tasks: ${data.overdueCount}
- Open tasks: ${data.openCount}
- Completed last 7 days: ${data.completedThisWeek}
- Urgent tasks: ${JSON.stringify(data.urgentTasks)}
- High priority tasks: ${JSON.stringify(data.highTasks)}
- Recently completed: ${JSON.stringify(data.completedTasks.slice(0, 5))}
- Category breakdown of open tasks: ${JSON.stringify(data.categoryBreakdown)}

Write 3 sections:
1. "This week at a glance" — 2-3 sentences summary
2. "Needs your attention" — bullet list of the most important items (max 5)
3. "Wins from last week" — brief acknowledgment of completions (1-2 sentences)

Use clean, minimal HTML. No excessive formatting. Keep it under 300 words.
Return only the HTML content, no JSON, no markdown.`

  const res = await fetch(
    `${GEMINI_BASE}/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
      }),
    }
  )

  if (!res.ok) return generateFallbackDigest(data)
  const json = await res.json()
  return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? generateFallbackDigest(data)
}

function generateFallbackDigest(data: {
  overdueCount: number
  openCount: number
  completedThisWeek: number
  urgentTasks: { title: string; category: string; dueDate: string | null; amount: string | null }[]
  highTasks: { title: string; category: string }[]
  completedTasks: { title: string; category: string }[]
}): string {
  const urgentList = data.urgentTasks.map(t =>
    `<li style="margin-bottom:6px;">${t.title}${t.amount ? ` <strong style="color:#4ade80">${t.amount}</strong>` : ""}</li>`
  ).join("")

  return `
    <h2 style="color:#f1f5f9;font-size:16px;font-weight:700;margin:0 0 8px;">This week at a glance</h2>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 20px;">
      You have ${data.openCount} open tasks${data.overdueCount > 0 ? `, including <strong style="color:#ef4444">${data.overdueCount} overdue</strong>` : ""}.
      ${data.completedThisWeek > 0 ? `You completed ${data.completedThisWeek} tasks last week.` : ""}
    </p>
    ${data.urgentTasks.length > 0 ? `
    <h2 style="color:#f1f5f9;font-size:16px;font-weight:700;margin:0 0 8px;">Needs your attention</h2>
    <ul style="color:#94a3b8;font-size:14px;padding-left:20px;margin:0 0 20px;">${urgentList}</ul>
    ` : ""}
    ${data.completedThisWeek > 0 ? `
    <h2 style="color:#f1f5f9;font-size:16px;font-weight:700;margin:0 0 8px;">Wins from last week</h2>
    <p style="color:#94a3b8;font-size:14px;margin:0;">
      You cleared ${data.completedThisWeek} task${data.completedThisWeek !== 1 ? "s" : ""} — great progress.
    </p>
    ` : ""}
  `
}

function buildDigestHtml(aiContent: string, appUrl: string, stats: {
  openCount: number
  overdueCount: number
  completedThisWeek: number
}): string {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;padding:0 16px;">
    <div style="background:#1e293b;border:1px solid #334155;border-radius:16px;overflow:hidden;">

      <!-- Header -->
      <div style="background:#1d4ed8;padding:24px 32px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#93c5fd;">Weekly Briefing</p>
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;">Good morning ☀️</h1>
        <p style="margin:4px 0 0;font-size:13px;color:#bfdbfe;">${today}</p>
      </div>

      <!-- Quick stats -->
      <div style="display:flex;border-bottom:1px solid #334155;">
        <div style="flex:1;padding:16px;text-align:center;border-right:1px solid #334155;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#f1f5f9;">${stats.openCount}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#64748b;">Open tasks</p>
        </div>
        <div style="flex:1;padding:16px;text-align:center;border-right:1px solid #334155;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#ef4444;">${stats.overdueCount}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#64748b;">Overdue</p>
        </div>
        <div style="flex:1;padding:16px;text-align:center;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#4ade80;">${stats.completedThisWeek}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#64748b;">Done this week</p>
        </div>
      </div>

      <!-- AI content -->
      <div style="padding:28px 32px;">
        ${aiContent}
      </div>

      <!-- CTA -->
      <div style="padding:0 32px 28px;">
        <a href="${appUrl}/dashboard"
           style="display:block;text-align:center;background:#1d4ed8;color:#fff;font-size:14px;font-weight:600;padding:13px 24px;border-radius:10px;text-decoration:none;">
          Open MailQuark →
        </a>
      </div>
    </div>
    <p style="text-align:center;font-size:11px;color:#334155;margin-top:16px;">
      MailQuark weekly digest · sent every Monday
    </p>
  </div>
</body>
</html>`
}

export async function GET(req: Request) {
  // Verify cron secret
  const auth = req.headers ? (req as any).headers?.get?.("authorization") : null
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const appUrl = process.env.NEXTAUTH_URL ?? "https://mail-quark.vercel.app"
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)

  try {
    // Get all users (single user app, but be clean)
    const users = await prisma.user.findMany({
      select: { id: true, email: true },
    })

    for (const user of users) {
      if (!user.email) continue

      // Open tasks
      const openTasks = await prisma.task.findMany({
        where: { userId: user.id, status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] } },
        select: { title: true, category: true, priority: true, dueDate: true, amount: true },
        orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
      })

      // Overdue
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const overdueCount = openTasks.filter(t => t.dueDate && new Date(t.dueDate) < today).length

      // Completed this week
      const completedTasks = await prisma.task.findMany({
        where: {
          userId: user.id,
          status: "DONE",
          completedAt: { gte: sevenDaysAgo },
        },
        select: { title: true, category: true },
        orderBy: { completedAt: "desc" },
        take: 10,
      })

      // Category breakdown of open tasks
      const categoryBreakdown: Record<string, number> = {}
      for (const t of openTasks) {
        categoryBreakdown[t.category] = (categoryBreakdown[t.category] ?? 0) + 1
      }

      const urgentTasks = openTasks
        .filter(t => t.priority === "URGENT")
        .map(t => ({ title: t.title, category: t.category, dueDate: t.dueDate?.toISOString() ?? null, amount: t.amount }))

      const highTasks = openTasks
        .filter(t => t.priority === "HIGH")
        .slice(0, 5)
        .map(t => ({ title: t.title, category: t.category, dueDate: t.dueDate?.toISOString() ?? null, amount: t.amount }))

      const aiContent = await generateDigest({
        overdueCount,
        openCount: openTasks.length,
        completedThisWeek: completedTasks.length,
        urgentTasks,
        highTasks,
        completedTasks,
        categoryBreakdown,
      })

      const html = buildDigestHtml(aiContent, appUrl, {
        openCount: openTasks.length,
        overdueCount,
        completedThisWeek: completedTasks.length,
      })

      await sendReminderEmail(user.id, user.email, "📋 Your weekly task briefing", html)
    }

    return NextResponse.json({ ok: true, users: users.length })
  } catch (err) {
    console.error("Digest cron error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
