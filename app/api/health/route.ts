import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)
  return NextResponse.json({
    ok: true,
    user: session?.user?.email ?? null,
    timestamp: new Date().toISOString(),
  })
}
