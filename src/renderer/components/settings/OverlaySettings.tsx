import { FieldGroup, FieldLabel, FieldLegend, FieldSet, Field } from '@/components/ui/field'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { OverlaySettings as Overlay } from '@/types'
import { SliderField, SwitchField } from './fields'

type Position = Overlay['position']
const POSITIONS: { value: Position; label: string }[] = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-right', label: 'Top right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-right', label: 'Bottom right' },
]

/**
 * Overlay mode. Enable, position, opacity and click-through reach the
 * window straight away through the handlers; the display choices are saved
 * with the rest of the settings.
 */
export function OverlaySettings({
  overlay,
  onEnable,
  onPosition,
  onOpacity,
  onOpacityCommit,
  onClickThrough,
  onChange,
}: {
  overlay: Overlay
  onEnable: (enabled: boolean) => void
  onPosition: (position: Position) => void
  onOpacity: (opacity: number) => void
  onOpacityCommit: (opacity: number) => void
  onClickThrough: (enabled: boolean) => void
  onChange: (next: Overlay) => void
}) {
  return (
    <FieldSet>
      <FieldLegend>Overlay mode</FieldLegend>
      <FieldGroup className="gap-4">
        <SwitchField
          id="overlay-enabled"
          label="Enable overlay mode"
          description="A small always-on-top widget instead of this window."
          checked={overlay.enabled}
          onChange={onEnable}
        />
        <Field>
          <FieldLabel id="overlay-position">Position</FieldLabel>
          <ToggleGroup
            aria-labelledby="overlay-position"
            variant="outline"
            className="grid grid-cols-2"
            value={[overlay.position]}
            onValueChange={(v) => v[0] && onPosition(v[0] as Position)}
          >
            {POSITIONS.map((p) => (
              <ToggleGroupItem key={p.value} value={p.value} aria-label={`Position overlay at ${p.label.toLowerCase()}`}>
                {p.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
        <SliderField
          id="overlay-opacity"
          label="Opacity"
          value={overlay.opacity}
          display={`${overlay.opacity}%`}
          min={50}
          max={100}
          step={5}
          minLabel="50%"
          maxLabel="100%"
          onChange={onOpacity}
          onCommit={onOpacityCommit}
        />
        <SwitchField
          id="overlay-click-through"
          label="Click-through"
          description="The overlay ignores clicks so you can work underneath it. Hover over it to interact."
          checked={overlay.clickThrough}
          onChange={onClickThrough}
        />
        <SwitchField
          id="overlay-percentage"
          label="Show percentage"
          checked={overlay.showPercentage}
          onChange={(showPercentage) => onChange({ ...overlay, showPercentage })}
        />
        <SwitchField
          id="overlay-bar"
          label="Show progress bar"
          checked={overlay.showProgressBar}
          onChange={(showProgressBar) => onChange({ ...overlay, showProgressBar })}
        />
      </FieldGroup>
    </FieldSet>
  )
}
