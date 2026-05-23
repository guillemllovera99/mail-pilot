import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { syncUserEmails } from "@/lib/email-sync"

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const result = await syncUserEmails(session.user.id)
  return NextResponse.json({ ok: true, ...result })
}
