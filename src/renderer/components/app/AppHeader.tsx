import { ChartColumn, Minus, Moon, Settings, Sun } from 'lucide-react'
import { setDark, useTheme } from '@/lib/theme'
import { IconAction } from './IconAction'
import { ThemeMenu } from './ThemeMenu'

/** Vercel's top bar: the app's mark and name, then the window's controls. */
export function AppHeader({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { dark } = useTheme()
  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1180px] items-center gap-3 px-4 sm:px-6">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <ChartColumn className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm leading-tight font-semibold tracking-tight">
            Usage Tracker
          </h1>
          <p className="truncate text-xs text-muted-foreground">Coding-Plan Usage Monitor</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <ThemeMenu />
          <IconAction
            label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun /> : <Moon />}
          </IconAction>
          <IconAction label="Open settings" onClick={onOpenSettings}>
            <Settings />
          </IconAction>
          <IconAction label="Minimize to tray" onClick={() => window.api.minimizeToTray()}>
            <Minus />
          </IconAction>
        </div>
      </div>
    </header>
  )
}
