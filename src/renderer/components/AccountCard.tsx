import { format } from 'date-fns'
import { CircleAlert, Crown, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { IconAction } from '@/components/app/IconAction'
import { UsageMeter } from '@/components/usage/UsageMeter'
import { cn } from '@/lib/utils'
import type { AccountConfig, AccountUsageState, ProviderInfo } from '@/types'
import { useUsageStore } from '@stores/useUsageStore'
import { ProviderIcon } from './ProviderIcon'

interface AccountCardProps {
  account: AccountConfig
  state: AccountUsageState | undefined
  provider?: ProviderInfo
  onRemove: (id: string) => void
}

const AUTH_LABEL: Record<string, string> = {
  oauthLocal: 'Local login',
  apiKey: 'API key',
  oauthPaste: 'Token',
}

/** The plan name, editable in place: a button that becomes an input. */
function PlanField({ plan, onSave }: { plan: string | undefined; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) return
    setDraft(plan ?? '')
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing, plan])

  const commit = () => {
    setEditing(false)
    onSave(draft)
  }
  // "Max 20x" reads better as "Max 20×".
  const pretty = plan ? plan.replace(/(\d)\s*x\b/i, '$1×') : undefined

  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
      <Crown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">Plan</p>
        {editing ? (
          <Input
            ref={inputRef}
            aria-label="Plan"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') setEditing(false)
            }}
            placeholder="e.g. Max 20x"
            className="mt-0.5 h-7"
          />
        ) : (
          <p className={cn('truncate text-sm font-medium', !plan && 'text-muted-foreground')}>
            {pretty ?? 'Set your plan'}
          </p>
        )}
      </div>
      {!editing && (
        <IconAction size="icon-sm" label={plan ? 'Edit plan' : 'Set plan'} onClick={() => setEditing(true)}>
          <Pencil />
        </IconAction>
      )}
    </div>
  )
}

/** A failed fetch, with one-click re-login for an expired or missing CLI login. */
function UsageError({ account, error, code }: { account: AccountConfig; error: string; code?: string }) {
  const [signingIn, setSigningIn] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const cli = account.provider === 'openai' ? 'codex' : 'claude'
  const canSignIn =
    (code === 'no_credential' || code === 'auth') &&
    (account.provider === 'anthropic' || account.provider === 'openai')

  const signIn = async () => {
    setSigningIn(true)
    try {
      const res = await window.api.claudeSetup.login(cli)
      setMessage(res.detail ?? (res.ok ? 'Terminal opened. Finish in your browser.' : 'Could not open a terminal.'))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not open a terminal.')
    } finally {
      // A short cooldown so rapid clicks cannot open a pile of terminals.
      setTimeout(() => setSigningIn(false), 4000)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Alert variant="destructive">
        <CircleAlert aria-hidden />
        <AlertDescription className="break-words">{error}</AlertDescription>
      </Alert>
      {canSignIn && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button size="sm" onClick={signIn} disabled={signingIn}>
            {signingIn ? 'Opening…' : 'Sign in'}
          </Button>
          <p className="text-xs text-muted-foreground">
            {message ??
              `Opens a terminal running ${cli === 'codex' ? 'codex login' : 'claude /login'}. Usage resumes by itself.`}
          </p>
        </div>
      )}
    </div>
  )
}

export function AccountCard({ account, state, provider, onRemove }: AccountCardProps) {
  const { refreshAccount, refreshingIds, updateAccountPlan } = useUsageStore()
  const refreshing = refreshingIds.includes(account.id)

  // Plan label: the account's own setting, else what the API reports.
  const apiPlan = state?.status === 'ok' ? state.usage.planLabel : undefined
  const plan = account.planLabel ?? apiPlan
  const authLabel = provider ? (AUTH_LABEL[provider.auth] ?? provider.auth) : null
  const email = state?.status === 'ok' ? state.usage.email : undefined

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 items-center gap-3">
          <ProviderIcon provider={account.provider} />
          <div className="min-w-0">
            <CardTitle className="truncate">{account.name}</CardTitle>
            <CardDescription className="flex min-w-0 items-center gap-1.5 text-xs">
              {authLabel && <span className="shrink-0">{authLabel}</span>}
              {email && (
                <>
                  <span aria-hidden>·</span>
                  <span className="truncate" title={email}>
                    {email}
                  </span>
                </>
              )}
            </CardDescription>
          </div>
        </div>
        <CardAction className="flex items-center">
          <IconAction
            size="icon-sm"
            label={`Refresh ${account.name}`}
            onClick={() => refreshAccount(account.id)}
            disabled={refreshing}
          >
            <RefreshCw className={cn(refreshing && 'animate-spin')} />
          </IconAction>
          <IconAction size="icon-sm" label={`Remove ${account.name}`} onClick={() => onRemove(account.id)}>
            <Trash2 />
          </IconAction>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <PlanField plan={plan} onSave={(value) => updateAccountPlan(account.id, value)} />
        {!state || state.status === 'loading' ? (
          <Skeleton className="h-[88px]" />
        ) : state.status === 'error' ? (
          <UsageError account={account} error={state.error} code={state.code} />
        ) : (
          <>
            <UsageMeter
              label="Session"
              windowLabel={state.usage.sessionWindowLabel}
              percent={state.usage.sessionPercent}
              resetTime={state.usage.sessionResetTime}
            />
            <UsageMeter
              label="Weekly"
              windowLabel={state.usage.weeklyWindowLabel}
              percent={state.usage.weeklyPercent}
              resetTime={state.usage.weeklyResetTime}
            />
          </>
        )}
      </CardContent>

      {state?.status === 'ok' && (
        <CardFooter className="justify-end">
          <span className="font-mono text-xs text-muted-foreground">
            Updated {format(new Date(state.usage.lastUpdated), 'HH:mm:ss')}
          </span>
        </CardFooter>
      )}
    </Card>
  )
}
