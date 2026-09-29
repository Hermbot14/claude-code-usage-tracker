import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * An icon-only shadcn Button with its name as the accessible label and as a
 * tooltip, so the icon is never the only way to tell what it does.
 */
export function IconAction({
  label,
  onClick,
  disabled,
  size = 'icon',
  className,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  size?: 'icon' | 'icon-sm'
  className?: string
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size={size}
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
            className={className}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
