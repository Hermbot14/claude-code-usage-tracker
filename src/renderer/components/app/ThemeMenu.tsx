import type { CSSProperties } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { THEMES, setTheme, useTheme, type ThemeId } from '@/lib/theme'

/** A theme's swatch: its data colour, passed in as a CSS variable. */
function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{ '--swatch': color } as CSSProperties}
      className="size-3.5 shrink-0 rounded-full bg-(--swatch) ring-1 ring-foreground/15"
    />
  )
}

/** Colour theme picker: shadcn's DropdownMenu with one radio item per theme. */
export function ThemeMenu() {
  const { theme } = useTheme()
  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={`Theme: ${current.name}. Change theme`} />
        }
      >
        <Swatch color={current.swatch} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(value) => setTheme(value as ThemeId)}
          >
            {THEMES.map((t) => (
              <DropdownMenuRadioItem key={t.id} value={t.id}>
                <Swatch color={t.swatch} />
                {t.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
