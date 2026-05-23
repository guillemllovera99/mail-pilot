import { prisma } from "@/lib/db"
import { getAccessToken } from "@/lib/graph"

const GRAPH_BASE = "https://graph.microsoft.com/v1.0"
const SELECT = "id,subject,from,receivedDateTime,bodyPreview,isRead,webLink"

function thirtyDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString()
}

interface GraphMessage {
  id: string
  subject?: string
  from?: { emailAddress?: { name?: string; address?: string } }
  receivedDateTime?: string
  bodyPreview?: string
  isRead?: boolean
  webLink?: string
}

interface GraphPage {
  value: GraphMessage[]
  "@odata.nextLink"?: string
  "@odata.deltaLink"?: string
}

async function graphGet(token: string, url: string): Promise<GraphPage> {
  const fullUrl = url.startsWith("https://") ? url : `${GRAPH_BASE}${url}`
  const res = await fetch(fullUrl, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Graph ${res.status}: ${body}`)
  }
  return res.json()
}

// ─── Sync inbox for one user ──────────────────────────────────────────────────

export async function syncUserEmails(userId: string): Promise<{
  synced: number
  skipped: number
  error?: string
}> {
  try {
    const token = await getAccessToken(userId)
    if (!token) throw new Error("No valid access token — user may need to re-authenticate")

    const syncState = await prisma.emailSyncState.findUnique({ where: { userId } })

    // First sync: last 30 days. Subsequent syncs: use saved delta link.
    let url: string = syncState?.deltaLink
      ? syncState.deltaLink
      : `/me/mailFolders/inbox/messages/delta?$select=${SELECT}&$filter=receivedDateTime ge ${thirtyDaysAgo()}&$top=50`

    let synced = 0
    let skipped = 0
    let deltaLink: string | undefined

    while (url) {
      const page = await graphGet(token, url)

      for (const msg of page.value) {
        if (!msg.id) continue

        // Skip if already stored
        const exists = await prisma.emailSuggestion.findUnique({ where: { emailId: msg.id } })
        if (exists) { skipped++; continue }

        const fromAddr = msg.from?.emailAddress?.address ?? null
        const fromName = msg.from?.emailAddress?.name ?? null
        const fromDisplay = fromName ? `${fromName} <${fromAddr}>` : fromAddr

        await prisma.emailSuggestion.create({
          data: {
            userId,
            emailId: msg.id,
            emailSubject: msg.subject ?? "(no subject)",
            emailFrom: fromDisplay,
            emailReceivedAt: msg.receivedDateTime ? new Date(msg.receivedDateTime) : null,
            // Body preview stored here so Phase 2 AI can read it
            suggestedDescription: msg.bodyPreview ?? null,
            // Placeholder — Phase 2 replaces this with AI-extracted task title
            suggestedTitle: msg.subject ?? "(no subject)",
            status: "PENDING",
          },
        })
        synced++
      }

      if (page["@odata.nextLink"]) {
        url = page["@odata.nextLink"]
      } else {
        deltaLink = page["@odata.deltaLink"]
        break
      }
    }

    // Save sync state
    await prisma.emailSyncState.upsert({
      where: { userId },
      create: {
        userId,
        deltaLink: deltaLink ?? null,
        lastSyncedAt: new Date(),
        emailsProcessedTotal: synced,
      },
      update: {
        deltaLink: deltaLink ?? undefined,
        lastSyncedAt: new Date(),
        emailsProcessedTotal: { increment: synced },
      },
    })

    console.log(`[email-sync] user=${userId} synced=${synced} skipped=${skipped}`)
    return { synced, skipped }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[email-sync] user=${userId}`, message)
    return { synced: 0, skipped: 0, error: message }
  }
}
