import { Check } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useUsageStore } from '@stores/useUsageStore'

interface CliStatus {
  claudeInstalled: boolean
  claudeVersion: string | null
  npmAvailable: boolean
}

function Step({ n, done, children }: { n: number; done?: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <Badge
        variant={done ? 'default' : 'outline'}
        className={cn('mt-0.5 size-5 px-0', done && 'bg-ok/10 text-ok')}
      >
        {done ? <Check aria-hidden /> : n}
        {done && <span className="sr-only">Done:</span>}
      </Badge>
      <div className="min-w-0 flex-1 text-sm leading-6">{children}</div>
    </li>
  )
}

function Code({ children, block }: { children: ReactNode; block?: boolean }) {
  return (
    <code
      className={cn(
        'rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground',
        block && 'mt-1 block w-fit max-w-full overflow-x-auto whitespace-nowrap',
      )}
    >
      {children}
    </code>
  )
}

const link = cn(buttonVariants({ variant: 'link' }), 'h-auto p-0 text-xs')

/** First run: install the Claude Code CLI, sign in, and the account appears. */
export function SetupGuide({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { discoverAndMergeLocalAccounts } = useUsageStore()
  const [cli, setCli] = useState<CliStatus | null>(null)
  const [installing, setInstalling] = useState(false)
  const [installMsg, setInstallMsg] = useState<string | null>(null)
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginMsg, setLoginMsg] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState<string | null>(null)

  // Probe for the CLI while the guide is shown (cheap and local).
  useEffect(() => {
    let cancelled = false
    window.api.claudeSetup
      .check()
      .then((s) => !cancelled && setCli(s))
      .catch(() => !cancelled && setCli({ claudeInstalled: false, claudeVersion: null, npmAvailable: false }))
    return () => {
      cancelled = true
    }
  }, [])

  const install = async () => {
    setInstalling(true)
    setInstallMsg(null)
    try {
      const res = await window.api.claudeSetup.install()
      setInstallMsg(res.detail ?? (res.ok ? 'Installed.' : 'Install failed.'))
      if (res.ok) setCli(await window.api.claudeSetup.check())
    } catch (err) {
      setInstallMsg(err instanceof Error ? err.message : 'Install failed.')
    } finally {
      setInstalling(false)
    }
  }

  const login = async () => {
    setLoginBusy(true)
    setLoginMsg(null)
    try {
      const res = await window.api.claudeSetup.login('claude')
      setLoginMsg(res.detail ?? (res.ok ? 'Terminal opened.' : 'Could not open a terminal.'))
    } catch (err) {
      setLoginMsg(err instanceof Error ? err.message : 'Could not open a terminal.')
    } finally {
      // A short cooldown so rapid clicks cannot open a pile of terminals.
      setTimeout(() => setLoginBusy(false), 4000)
    }
  }

  const rescan = async () => {
    setScanning(true)
    setScanMsg(null)
    try {
      // Re-probe the CLI too: it may have been installed in another terminal.
      const [added, status] = await Promise.all([
        discoverAndMergeLocalAccounts({ rescanDismissed: true }),
        window.api.claudeSetup.check().catch(() => null),
      ])
      if (status) setCli(status)
      if (added === 0) {
        setScanMsg(
          'No CLI login found yet. Finish the steps above, then scan again. The app also rescans by itself every 10 seconds.',
        )
      }
    } finally {
      setScanning(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Connect your Claude Code account</h2>
        </CardTitle>
        <CardDescription>
          Usage Tracker reads the login your Claude Code CLI already has, so there is no API key to
          paste.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ol className="flex flex-col gap-3">
          <Step n={1} done={cli?.claudeInstalled === true}>
            {cli === null ? (
              'Checking for the Claude Code CLI…'
            ) : cli.claudeInstalled ? (
              <>
                Claude Code is installed
                {cli.claudeVersion && (
                  // "2.1.215 (Claude Code)" shows as "v2.1.215".
                  <span className="text-muted-foreground"> (v{cli.claudeVersion.split(' ')[0]})</span>
                )}
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  Install Claude Code
                  <Button size="sm" onClick={install} disabled={installing}>
                    {installing ? 'Installing…' : 'Install now'}
                  </Button>
                </div>
                {installMsg && (
                  <p className="mt-1 text-xs whitespace-pre-wrap text-muted-foreground">{installMsg}</p>
                )}
                {!cli.npmAvailable && (
                  <p className="mt-1 flex flex-wrap gap-x-3">
                    <a className={link} href="https://nodejs.org/en/download" target="_blank" rel="noreferrer">
                      Get Node.js
                    </a>
                    <a className={link} href="https://code.claude.com/docs" target="_blank" rel="noreferrer">
                      Claude Code install guide
                    </a>
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  or run it yourself: <Code block>npm install -g @anthropic-ai/claude-code</Code>
                </p>
              </>
            )}
          </Step>
          <Step n={2}>
            <div className="flex flex-wrap items-center gap-2">
              Sign in to Claude
              <Button size="sm" onClick={login} disabled={loginBusy || (cli !== null && !cli.claudeInstalled)}>
                {loginBusy ? 'Opening…' : 'Sign in'}
              </Button>
            </div>
            {loginMsg && <p className="mt-1 text-xs text-muted-foreground">{loginMsg}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              Opens a terminal running <Code>claude /login</Code>. Finish in your browser.
            </p>
          </Step>
        </ol>
        <p className="text-sm text-muted-foreground">
          That&apos;s it. Your account appears here a few seconds after you sign in.
        </p>
        {scanMsg && <p className="text-xs text-muted-foreground">{scanMsg}</p>}
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        <Button onClick={rescan} disabled={scanning}>
          {scanning ? 'Scanning…' : 'Scan for accounts'}
        </Button>
        <Button variant="outline" onClick={onOpenSettings}>
          Add API-key account instead
        </Button>
        <p className="basis-full text-xs text-muted-foreground">
          Also works with the OpenAI Codex CLI (<Code>codex login</Code>) and Z.AI / GLM API keys.
        </p>
      </CardFooter>
    </Card>
  )
}
