/**
 * Claude Code OAuth token refresh
 *
 * The token Claude Code stores in ~/.claude/.credentials.json expires every
 * ~8h; the CLI refreshes it when it runs, but a passive tracker must refresh
 * it itself or usage calls 401. We refresh via the documented Claude Code
 * OAuth client and write the rotated tokens back to the credentials file
 * (atomically, preserving every other field, with a one-time .bak backup) so
 * the CLI and this app stay in sync — Anthropic rotates the refresh token, so
 * NOT persisting it would invalidate the CLI's copy.
 *
 * Ported from Aperant's token-refresh.ts.
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, renameSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const CRED_PATH = join(homedir(), '.claude', '.credentials.json')
const TOKEN_ENDPOINT = 'https://console.anthropic.com/v1/oauth/token'
const CLAUDE_CODE_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e'
/** Refresh if the token is expired or within this window of expiring. */
const EXPIRY_SKEW_MS = 300_000 // 5 minutes — gives ample buffer for network + processing

export interface ClaudeTokenResult {
  token: string | null
  email?: string | null
  error?: string
}

interface ClaudeOAuth {
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  email?: string
  emailAddress?: string
}
interface ClaudeCredFile {
  claudeAiOauth?: ClaudeOAuth
  [key: string]: unknown
}

// De-dupe concurrent refreshes (multiple accounts/polls can race).
let inFlight: Promise<ClaudeTokenResult> | null = null
/** After a failed refresh, don't retry until this timestamp. Prevents hammering the endpoint. */
let refreshBlockedUntil = 0
const REFRESH_BLOCK_MS = 4 * 60_000 // 4 minutes between failed refresh attempts

function readCredFile(): ClaudeCredFile | null {
  try {
    return JSON.parse(readFileSync(CRED_PATH, 'utf-8')) as ClaudeCredFile
  } catch {
    return null
  }
}

function emailOf(o: ClaudeOAuth | undefined): string | null {
  return o?.email ?? o?.emailAddress ?? null
}

/** Atomically persist refreshed tokens, preserving all other fields. */
function writeBack(full: ClaudeCredFile, update: Partial<ClaudeOAuth>): void {
  if (!existsSync(`${CRED_PATH}.bak`)) {
    try {
      copyFileSync(CRED_PATH, `${CRED_PATH}.bak`)
    } catch {
      // backup is best-effort
    }
  }
  full.claudeAiOauth = { ...full.claudeAiOauth, ...update }
  const tmp = `${CRED_PATH}.tmp`
  writeFileSync(tmp, JSON.stringify(full, null, 2), 'utf-8')
  renameSync(tmp, CRED_PATH)
}

async function refreshWith(refreshToken: string): Promise<
  { ok: true; access_token: string; refresh_token?: string; expires_in?: number } | { ok: false; error: string }
> {
  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLAUDE_CODE_CLIENT_ID,
    })
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      let detail = res.statusText
      try {
        const j = (await res.json()) as { error_description?: string; error?: string }
        detail = j.error_description ?? j.error ?? detail
      } catch {
        // ignore
      }
      return { ok: false, error: `Token refresh failed (${res.status}): ${detail}` }
    }
    const data = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number }
    if (!data.access_token) return { ok: false, error: 'Refresh response missing access_token' }
    return { ok: true, access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Token refresh network error' }
  }
}

/**
 * Return a valid Claude access token, refreshing (and persisting) if the stored
 * one is expired or `force` is set. Falls back to the stored token if no
 * refresh token is available.
 */
export async function getFreshClaudeToken(force = false): Promise<ClaudeTokenResult> {
  const full = readCredFile()
  const oauth = full?.claudeAiOauth
  if (!oauth || (!oauth.accessToken && !oauth.refreshToken)) {
    return { token: null, error: 'No Claude Code credentials found (~/.claude/.credentials.json)' }
  }

  const stillValid =
    !!oauth.accessToken &&
    typeof oauth.expiresAt === 'number' &&
    Date.now() < oauth.expiresAt - EXPIRY_SKEW_MS

  if (stillValid && !force) {
    return { token: oauth.accessToken!, email: emailOf(oauth) }
  }

  if (!oauth.refreshToken) {
    // Can't refresh — return the (possibly stale) token and let the caller surface 401.
    return {
      token: oauth.accessToken ?? null,
      email: emailOf(oauth),
      error: oauth.accessToken ? undefined : 'Claude token expired and no refresh token available',
    }
  }

  // Don't hammer the refresh endpoint after a failure — back off for REFRESH_BLOCK_MS.
  if (!inFlight && Date.now() < refreshBlockedUntil) {
    return {
      token: oauth.accessToken ?? null,
      email: emailOf(oauth),
      error: 'Token refresh on cooldown — will retry shortly',
    }
  }

  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      const result = await refreshWith(oauth.refreshToken!)
      if (!result.ok) {
        refreshBlockedUntil = Date.now() + REFRESH_BLOCK_MS
        // Refresh failed — fall back to stored token (may still 401) but report why.
        return { token: oauth.accessToken ?? null, email: emailOf(oauth), error: result.error }
      }
      refreshBlockedUntil = 0 // Reset block on success
      const expiresAt = Date.now() + (result.expires_in ?? 28_800) * 1000
      try {
        writeBack(full!, {
          accessToken: result.access_token,
          refreshToken: result.refresh_token ?? oauth.refreshToken,
          expiresAt,
        })
      } catch (err) {
        console.error('[claude-token] Failed to persist refreshed token:', err)
      }
      return { token: result.access_token, email: emailOf(oauth) }
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}
