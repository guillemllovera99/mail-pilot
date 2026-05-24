export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { syncUserEmails } from "@/lib/email-sync"
import { syncUserGmail } from "@/lib/gmail-sync"

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Sync all Microsoft users
  const msAccounts = await prisma.account.findMany({
    where: { provider: "azure-ad" },
    select: { userId: true },
    distinct: ["userId"],
  })

  // Sync all Google users
  const googleAccounts = await prisma.account.findMany({
    where: { provider: "google" },
    select: { userId: true },
    distinct: ["userId"],
  })

  const msResults = await Promise.allSettled(
    msAccounts.map(({ userId }) => syncUserEmails(userId))
  )
  const googleResults = await Promise.allSettled(
    googleAccounts.map(({ userId }) => syncUserGmail(userId))
  )

  const summary = [
    ...msResults.map((r, i) => ({
      userId: msAccounts[i].userId, provider: "outlook",
      ...(r.status === "fulfilled" ? r.value : { error: String(r.reason) }),
    })),
    ...googleResults.map((r, i) => ({
      userId: googleAccounts[i].userId, provider: "gmail",
      ...(r.status === "fulfilled" ? r.value : { error: String(r.reason) }),
    })),
  ]

  console.log("[cron/email-sync] done", summary)
  return NextResponse.json({ ok: true, users: summary.length, summary })
}
