export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { syncUserEmails } from "@/lib/email-sync"

export const maxDuration = 60 // Vercel max for Hobby

export async function GET(request: Request) {
  // Verify cron secret (Vercel sends this automatically; we also check manually)
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get all users who have a linked azure-ad account
  const accounts = await prisma.account.findMany({
    where: { provider: "azure-ad" },
    select: { userId: true },
    distinct: ["userId"],
  })

  const results = await Promise.allSettled(
    accounts.map(({ userId }) => syncUserEmails(userId))
  )

  const summary = results.map((r, i) => ({
    userId: accounts[i].userId,
    ...(r.status === "fulfilled" ? r.value : { error: String(r.reason) }),
  }))

  console.log("[cron/email-sync] done", summary)
  return NextResponse.json({ ok: true, users: summary.length, summary })
}
