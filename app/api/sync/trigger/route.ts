export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { syncUserEmails } from "@/lib/email-sync"
import { syncUserGmail } from "@/lib/gmail-sync"
import { getUserProvider } from "@/lib/graph"

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const provider = await getUserProvider(session.user.id)
  const result = provider === "google"
    ? await syncUserGmail(session.user.id)
    : await syncUserEmails(session.user.id)

  return NextResponse.json({ ok: true, provider, ...result })
}
