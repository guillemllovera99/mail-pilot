import { prisma } from "@/lib/db"

const TOKEN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token"
const GRAPH_BASE = "https://graph.microsoft.com/v1.0"

// ─── Token refresh ────────────────────────────────────────────────────────────

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  ext_expires_in: number
  token_type: string
}

async function refreshAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "azure-ad" },
  })
  if (!account?.refresh_token) return null

  const params = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID!,
    client_secret: process.env.AZURE_CLIENT_SECRET!,
    grant_type: "refresh_token",
    refresh_token: account.refresh_token,
    scope: "openid profile email offline_access Mail.Read Calendars.ReadWrite User.Read",
  })

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })

  if (!res.ok) {
    console.error("[graph] Token refresh failed:", await res.text())
    return null
  }

  const data: TokenResponse = await res.json()
  const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in

  // Persist the new tokens
  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt,
      ext_expires_in: data.ext_expires_in,
    },
  })

  return data.access_token
}

// ─── Token getter ─────────────────────────────────────────────────────────────

export async function getAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "azure-ad" },
  })
  if (!account) return null

  // Check if current token is still valid (with 60s buffer)
  const nowSec = Math.floor(Date.now() / 1000)
  const isValid = account.expires_at && account.expires_at > nowSec + 60

  if (isValid && account.access_token) {
    return account.access_token
  }

  // Refresh
  return refreshAccessToken(userId)
}

// ─── Graph API fetch ──────────────────────────────────────────────────────────

export async function graphFetch(
  userId: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken(userId)
  if (!token) throw new Error(`[graph] No valid token for user ${userId}`)

  return fetch(`${GRAPH_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  })
}
