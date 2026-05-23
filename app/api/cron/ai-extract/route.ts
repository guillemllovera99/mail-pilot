export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { runAiExtraction } from "@/lib/ai-extract"

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await runAiExtraction()
  console.log("[cron/ai-extract] done", result)
  return NextResponse.json({ ok: true, ...result })
}
