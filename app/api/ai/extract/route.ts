import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { runAiExtraction } from "@/lib/ai-extract"

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const result = await runAiExtraction(session.user.id)
  return NextResponse.json({ ok: true, ...result })
}
