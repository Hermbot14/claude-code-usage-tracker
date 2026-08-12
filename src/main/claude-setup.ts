/**
 * One-click Claude Code setup helpers.
 *
 * Powers the first-run guide's "Install Claude Code" and "Sign in" buttons so
 * users never have to open a terminal themselves:
 *
 *   check   — is the `claude` CLI on PATH? is npm available to install it?
 *   install — run `npm install -g @anthropic-ai/claude-code` (fixed argv,
 *             nothing user-controlled) and report the outcome.
 *   login   — open a visible terminal running `claude /login`; the OAuth flow
 *             finishes in the browser and the app's 10s auto-rescan picks the
 *             new credentials up without a restart.
 *
 * The login step intentionally opens a real terminal instead of a hidden
 * process: /login is an interactive TUI flow, and users should see it.
 */

import { exec, execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface ClaudeCliStatus {
  claudeInstalled: boolean
  claudeVersion: string | null
  npmAvailable: boolean
}

export interface SetupActionResult {
  ok: boolean
  /** Human-readable detail: version string, error text, or output tail. */
  detail?: string
}

const IS_WIN = process.platform === 'win32'

/** Resolve a CLI on PATH, tolerating the .cmd/.ps1 shims npm uses on Windows. */
async function probe(cmd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(cmd, args, {
      // Generous: a cold CLI start (npm shim → node → cli.js) can take a while
      // on slow disks; a false "not installed" is worse than a slow probe.
      timeout: 30_000,
      windowsHide: true,
      // npm/claude are .cmd shims on Windows — they need a shell to launch.
      shell: IS_WIN,
    })
    return stdout.trim() || ''
  } catch {
    return null
  }
}

export async function checkClaudeCli(): Promise<ClaudeCliStatus> {
  const [claudeVersion, npmVersion] = await Promise.all([
    probe('claude', ['--version']),
    probe('npm', ['--version']),
  ])
  return {
    claudeInstalled: claudeVersion !== null,
    claudeVersion,
    npmAvailable: npmVersion !== null,
  }
}

/**
 * Install the Claude Code CLI globally via npm. Fixed package name — no user
 * input ever reaches the command line.
 */
export async function installClaudeCli(): Promise<SetupActionResult> {
  const status = await checkClaudeCli()
  if (status.claudeInstalled) {
    return { ok: true, detail: `Already installed (${status.claudeVersion})` }
  }
  if (!status.npmAvailable) {
    return {
      ok: false,
      detail:
        'npm was not found. Install Node.js from nodejs.org first, then try again (or install Claude Code manually).',
    }
  }
  return new Promise((resolve) => {
    const child = exec(
      'npm install -g @anthropic-ai/claude-code',
      { timeout: 5 * 60_000, windowsHide: true },
      async (error, _stdout, stderr) => {
        if (error) {
          const tail = (stderr || error.message || '').trim().split('\n').slice(-4).join('\n')
          resolve({ ok: false, detail: tail || 'npm install failed' })
          return
        }
        const after = await checkClaudeCli()
        resolve(
          after.claudeInstalled
            ? { ok: true, detail: `Installed (${after.claudeVersion})` }
            : {
                ok: false,
                detail:
                  'npm reported success but `claude` is not on PATH yet — restart the app (or your terminal) and rescan.',
              },
        )
      },
    )
    child.on('error', (err) => resolve({ ok: false, detail: err.message }))
  })
}

/**
 * Providers we can open a login terminal for. The command strings are FIXED —
 * the provider id is validated against this map and nothing else ever reaches
 * a shell.
 */
const LOGIN_COMMANDS: Record<string, { probeCmd: string; loginCmd: string; label: string }> = {
  claude: { probeCmd: 'claude', loginCmd: 'claude /login', label: 'Claude Code' },
  codex: { probeCmd: 'codex', loginCmd: 'codex login', label: 'Codex' },
}

export type LoginProvider = keyof typeof LOGIN_COMMANDS

/**
 * Open a visible terminal running the provider's login command. Fire-and-forget:
 * the user completes OAuth in the browser; the app's credential rescan (empty
 * state) or regular poller (existing account) picks the new token up.
 */
export async function launchCliLogin(provider: string = 'claude'): Promise<SetupActionResult> {
  const entry = LOGIN_COMMANDS[provider]
  if (!entry) return { ok: false, detail: `Unknown provider: ${provider}` }

  const installed = (await probe(entry.probeCmd, ['--version'])) !== null
  if (!installed) {
    return {
      ok: false,
      detail:
        provider === 'claude'
          ? 'Claude Code is not installed yet — run Install first.'
          : `The ${entry.label} CLI is not installed.`,
    }
  }
  try {
    const cmd = entry.loginCmd
    if (IS_WIN) {
      // Detached cmd.exe gets its own visible console window. cmd resolves the
      // .cmd npm shims and — unlike PowerShell, which resolves the .ps1 shims —
      // is immune to ExecutionPolicy blocking scripts. /k keeps the window open
      // so the user can see the login result. Argv is fully fixed.
      const child = spawn('cmd.exe', ['/k', cmd], {
        detached: true,
        stdio: 'ignore',
        shell: false,
        windowsVerbatimArguments: true,
      })
      child.unref()
    } else if (process.platform === 'darwin') {
      const child = spawn(
        'osascript',
        ['-e', `tell application "Terminal" to do script "${cmd}"`, '-e', 'tell application "Terminal" to activate'],
        { detached: true, stdio: 'ignore' },
      )
      child.unref()
    } else {
      // Best-effort on Linux: x-terminal-emulator is the Debian alternatives
      // entry point; fall back to gnome-terminal.
      const child = spawn('sh', ['-c', `x-terminal-emulator -e ${cmd} || gnome-terminal -- ${cmd}`], {
        detached: true,
        stdio: 'ignore',
      })
      child.unref()
    }
    return {
      ok: true,
      detail: 'A terminal window opened — finish signing in via your browser. Your account will appear here automatically.',
    }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'Failed to open a terminal' }
  }
}
