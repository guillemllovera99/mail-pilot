import { prisma } from "@/lib/db"

const MS_TOKEN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GRAPH_BASE = "https://graph.microsoft.com/v1.0"

// ─── Token refresh ────────────────────────────────────────────────────────────

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  ext_expires_in: number
  token_type: string
}

async function refreshMicrosoftToken(accountId: string, refreshToken: string): Promise<string | null> {
  const params = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID!,
    client_secret: process.env.AZURE_CLIENT_SECRET!,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: "openid profile email offline_access Mail.Read Mail.Send Calendars.ReadWrite User.Read",
  })
  const res = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })
  if (!res.ok) { console.error("[graph] MS token refresh failed:", await res.text()); return null }
  const data: TokenResponse = await res.json()
  await prisma.account.update({
    where: { id: accountId },
    data: {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
    },
  })
  return data.access_token
}

async function refreshGoogleToken(accountId: string, refreshToken: string): Promise<string | null> {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  })
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })
  if (!res.ok) { console.error("[graph] Google token refresh failed:", await res.text()); return null }
  const data = await res.json()
  await prisma.account.update({
    where: { id: accountId },
    data: {
      access_token: data.access_token,
      expires_at: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    },
  })
  return data.access_token
}

// ─── Token getter (works for both providers) ──────────────────────────────────

export async function getAccessToken(userId: string, provider?: "azure-ad" | "google"): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, ...(provider ? { provider } : {}) },
    orderBy: { provider: "asc" }, // deterministic
  })
  if (!account) return null

  const nowSec = Math.floor(Date.now() / 1000)
  const isValid = account.expires_at && account.expires_at > nowSec + 60
  if (isValid && account.access_token) return account.access_token

  if (!account.refresh_token) return null
  if (account.provider === "google") return refreshGoogleToken(account.id, account.refresh_token)
  return refreshMicrosoftToken(account.id, account.refresh_token)
}

export async function getUserProvider(userId: string): Promise<"azure-ad" | "google" | null> {
  const account = await prisma.account.findFirst({ where: { userId }, select: { provider: true } })
  if (!account) return null
  if (account.provider === "google") return "google"
  return "azure-ad"
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
