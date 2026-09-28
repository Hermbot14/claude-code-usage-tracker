import { useEffect, useState } from 'react'
import { AccountsView } from '@components/AccountsView'
import { CostPanel } from '@components/CostPanel'
import { SettingsPanel } from '@components/SettingsPanel'
import { UsageOverlay } from '@components/UsageOverlay'
import { AppHeader } from '@components/app/AppHeader'
import { useUsageStore } from '@stores/useUsageStore'
import { useAccountsData } from '@hooks/useAccountsData'
import { startTheme } from '@/lib/theme'

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const { settings, updateSettings } = useUsageStore()

  // Drive multi-account discovery + polling.
  useAccountsData()

  // The preloader in index.html applied the saved theme before first paint;
  // this keeps it in sync (and following the OS) from here on.
  useEffect(() => {
    const stop = startTheme()
    // Re-enable transitions after the first paint (the preloader disabled
    // them so the first background does not fade in).
    requestAnimationFrame(() =>
      requestAnimationFrame(() => document.documentElement.classList.remove('no-transition')),
    )
    return stop
  }, [])

  // Expand from overlay mode back to the full window. Persist enabled=false
  // FIRST (so the recreated window's renderer reloads in dashboard mode), then
  // ask main to recreate the normal window.
  const handleExpandFromOverlay = async () => {
    await updateSettings({ overlayMode: { ...settings.overlayMode, enabled: false } })
    await window.api.setOverlayMode(false)
  }

  if (settings.overlayMode.enabled) {
    return <UsageOverlay onExpand={handleExpandFromOverlay} />
  }

  return (
    <div className="min-h-full bg-background">
      <AppHeader onOpenSettings={() => setIsSettingsOpen(true)} />
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 py-6 sm:px-6">
        <AccountsView onOpenSettings={() => setIsSettingsOpen(true)} />
        {/* API-equivalent spend: independent of the account quota cards
            above, sourced from the local Claude Code cost ledger. */}
        <CostPanel />
        <footer className="pb-2 text-center text-xs text-muted-foreground">
          Running in background. Access anytime from the system tray.
        </footer>
      </main>
      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  )
}

export default App
