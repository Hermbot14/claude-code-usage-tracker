import { Check, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldDescription, FieldGroup, FieldLegend, FieldSeparator, FieldSet } from '@/components/ui/field'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { OverlaySettings as Overlay, Settings } from '@/types'
import { useUsageStore } from '@stores/useUsageStore'
import { AccountsManager } from './AccountsManager'
import { OverlaySettings } from './settings/OverlaySettings'
import { SliderField, SwitchField } from './settings/fields'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

const THRESHOLDS = [80, 90, 100]

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { settings, updateSettings } = useUsageStore()
  const [local, setLocal] = useState<Settings>({ ...settings })
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Start from the saved settings each time the dialog opens.
  useEffect(() => {
    if (isOpen) setLocal({ ...settings })
  }, [isOpen, settings])

  const set = <K extends keyof Settings>(field: K, value: Settings[K]) =>
    setLocal((prev) => ({ ...prev, [field]: value }))
  const setOverlay = (overlayMode: Overlay) => set('overlayMode', overlayMode)

  // Overlay mode rebuilds the window. Persist BEFORE asking for it: the
  // rebuild destroys this renderer, so a save made afterwards may never
  // finish (it once left the app stuck in overlay with no expand button).
  const enableOverlay = async (enabled: boolean) => {
    const overlayMode = { ...local.overlayMode, enabled }
    setOverlay(overlayMode)
    await updateSettings({ overlayMode })
    await window.api.setOverlayMode(enabled)
  }

  const setClickThrough = async (clickThrough: boolean) => {
    const overlayMode = { ...local.overlayMode, clickThrough }
    setOverlay(overlayMode)
    const result = await window.api.setClickThrough(clickThrough)
    if (result.success) await updateSettings({ overlayMode })
  }

  const setPosition = async (position: Overlay['position']) => {
    const overlayMode = { ...local.overlayMode, position }
    setOverlay(overlayMode)
    if (local.overlayMode.enabled) await window.api.setOverlayPosition(position)
    await updateSettings({ overlayMode })
  }

  const commitOpacity = async (opacity: number) => {
    const overlayMode = { ...local.overlayMode, opacity }
    if (local.overlayMode.enabled) await window.api.setOverlayOpacity(opacity)
    await updateSettings({ overlayMode })
  }

  const save = async () => {
    setSaveStatus('saving')
    try {
      await updateSettings(local)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
      setTimeout(() => onClose(), 500)
    } catch (error) {
      console.error('Failed to save settings:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-md"
      >
        <DialogHeader className="flex-row items-center justify-between border-b px-4 py-3">
          <DialogTitle>Settings</DialogTitle>
          <DialogClose render={<Button variant="ghost" size="icon-sm" aria-label="Close settings" />}>
            <X />
          </DialogClose>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <FieldGroup className="gap-6">
            <AccountsManager />
            <FieldSeparator />
            <FieldSet>
              <FieldLegend>Refresh</FieldLegend>
              <SliderField
                id="refresh-interval"
                label="Refresh interval"
                value={local.refreshInterval}
                display={`${local.refreshInterval}s`}
                min={10}
                max={300}
                step={10}
                minLabel="10s"
                maxLabel="5 min"
                onChange={(v) => set('refreshInterval', v)}
              />
            </FieldSet>
            <FieldSeparator />
            <FieldSet>
              <FieldLegend>Alerts</FieldLegend>
              <FieldDescription id="alert-thresholds">Notify me when usage reaches:</FieldDescription>
              <ToggleGroup
                multiple
                variant="outline"
                aria-labelledby="alert-thresholds"
                value={local.alertThresholds.map(String)}
                onValueChange={(v) => set('alertThresholds', v.map(Number).sort((a, b) => a - b))}
              >
                {THRESHOLDS.map((t) => (
                  <ToggleGroupItem key={t} value={String(t)} aria-label={`Alert at ${t}% usage`}>
                    {t}%
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <SwitchField
                id="notifications"
                label="Desktop notifications"
                checked={local.notificationsEnabled}
                onChange={(v) => set('notificationsEnabled', v)}
              />
              <SwitchField
                id="sound"
                label="Sound alerts"
                checked={local.soundAlertEnabled}
                onChange={(v) => set('soundAlertEnabled', v)}
              />
            </FieldSet>
            <FieldSeparator />
            <OverlaySettings
              overlay={local.overlayMode}
              onEnable={enableOverlay}
              onPosition={setPosition}
              onOpacity={(opacity) => setOverlay({ ...local.overlayMode, opacity })}
              onOpacityCommit={commitOpacity}
              onClickThrough={setClickThrough}
              onChange={setOverlay}
            />
          </FieldGroup>
        </div>

        <DialogFooter className="m-0 flex-row items-center justify-between gap-2 px-4 py-3">
          <div aria-live="polite">
            {saveStatus === 'saved' && (
              <Badge className="bg-ok/10 text-ok">
                <Check data-icon="inline-start" aria-hidden />
                Settings saved
              </Badge>
            )}
            {saveStatus === 'error' && <Badge variant="destructive">Failed to save</Badge>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saveStatus === 'saving'} aria-busy={saveStatus === 'saving'}>
              {saveStatus === 'saving' ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
