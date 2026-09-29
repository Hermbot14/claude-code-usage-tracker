import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'

/** A setting that is on or off: label and description left, Switch right. */
export function SwitchField({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
      </FieldContent>
      <Switch id={id} checked={checked} onCheckedChange={(value) => onChange(value)} />
    </Field>
  )
}

/**
 * A number on a Slider: label and current value above, the range's ends
 * below. `onChange` fires while dragging; `onCommit` once, on release, for
 * work that should not run on every step (IPC, saving).
 */
export function SliderField({
  id,
  label,
  value,
  display,
  min,
  max,
  step,
  minLabel,
  maxLabel,
  onChange,
  onCommit,
}: {
  id: string
  label: string
  value: number
  display: string
  min: number
  max: number
  step: number
  minLabel: string
  maxLabel: string
  onChange: (value: number) => void
  onCommit?: (value: number) => void
}) {
  const first = (v: number | readonly number[]) => (Array.isArray(v) ? v[0] : (v as number))
  return (
    <Field>
      <div className="flex items-baseline justify-between gap-2">
        <FieldLabel id={id}>{label}</FieldLabel>
        <span className="font-mono text-sm tabular-nums">{display}</span>
      </div>
      <Slider
        aria-labelledby={id}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(first(v))}
        onValueCommitted={(v) => onCommit?.(first(v))}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </Field>
  )
}
