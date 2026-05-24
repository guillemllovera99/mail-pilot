import { prisma } from "@/lib/db"
import { getAccessToken } from "@/lib/graph"

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1"

interface GmailMessage {
  id: string
  threadId: string
  snippet?: string
  payload?: {
    headers?: { name: string; value: string }[]
    parts?: { mimeType: string; body?: { data?: string } }[]
    body?: { data?: string }
  }
  internalDate?: string
}

interface GmailListResponse {
  messages?: { id: string; threadId: string }[]
  nextPageToken?: string
}

async function gmailFetch(token: string, path: string): Promise<Response> {
  return fetch(`${GMAIL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

function getHeader(msg: GmailMessage, name: string): string {
  return msg.payload?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? ""
}

function decodeBase64(data: string): string {
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
  } catch {
    return ""
  }
}

function extractSnippet(msg: GmailMessage): string {
  // Use Gmail's built-in snippet (first 200 chars of email body)
  if (msg.snippet) return msg.snippet.slice(0, 500)
  return ""
}

export async function syncUserGmail(userId: string): Promise<{
  synced: number
  skipped: number
  error?: string
}> {
  try {
    const token = await getAccessToken(userId, "google")
    if (!token) throw new Error("No valid Google access token — user may need to re-authenticate")

    // Get last sync state to know how far back to look
    const syncState = await prisma.emailSyncState.findUnique({ where: { userId } })
    const afterMs = syncState?.lastSyncedAt
      ? syncState.lastSyncedAt.getTime()
      : Date.now() - 30 * 86400000 // last 30 days on first sync

    const afterSec = Math.floor(afterMs / 1000)

    // List inbox messages newer than last sync
    const query = `in:inbox after:${afterSec}`
    const listRes = await gmailFetch(token, `/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`)

    if (!listRes.ok) {
      const err = await listRes.text()
      throw new Error(`Gmail list ${listRes.status}: ${err}`)
    }

    const listData: GmailListResponse = await listRes.json()
    const messages = listData.messages ?? []

    let synced = 0
    let skipped = 0

    for (const { id } of messages) {
      // Skip already-stored emails
      const exists = await prisma.emailSuggestion.findUnique({ where: { emailId: id } })
      if (exists) { skipped++; continue }

      // Fetch message metadata + snippet
      const msgRes = await gmailFetch(token, `/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`)
      if (!msgRes.ok) continue

      const msg: GmailMessage = await msgRes.json()

      const subject = getHeader(msg, "Subject") || "(no subject)"
      const fromRaw = getHeader(msg, "From") // e.g. "John Doe <john@example.com>"
      const date = msg.internalDate ? new Date(parseInt(msg.internalDate)) : new Date()
      const snippet = msg.snippet?.slice(0, 500) ?? ""

      await prisma.emailSuggestion.create({
        data: {
          userId,
          emailId: id,
          emailSubject: subject,
          emailFrom: fromRaw,
          emailReceivedAt: date,
          suggestedDescription: snippet,
          suggestedTitle: subject,
          status: "PENDING",
        },
      })
      synced++
    }

    // Update sync state
    await prisma.emailSyncState.upsert({
      where: { userId },
      create: {
        userId,
        lastSyncedAt: new Date(),
        emailsProcessedTotal: synced,
      },
      update: {
        lastSyncedAt: new Date(),
        emailsProcessedTotal: { increment: synced },
      },
    })

    console.log(`[gmail-sync] user=${userId} synced=${synced} skipped=${skipped}`)
    return { synced, skipped }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[gmail-sync] user=${userId}`, message)
    return { synced: 0, skipped: 0, error: message }
  }
}
