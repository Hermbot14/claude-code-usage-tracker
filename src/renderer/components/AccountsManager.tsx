import { CircleCheck, Info } from 'lucide-react'
import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ProviderId } from '@/types'
import { useUsageStore } from '@stores/useUsageStore'
import { ProviderIcon } from './ProviderIcon'

/** Settings: the tracked accounts, and a form to add one. */
export function AccountsManager() {
  const { accounts, providers, localAccounts, addAccount, removeAccount } = useUsageStore()
  const [providerId, setProviderId] = useState<ProviderId | null>(null)
  const [name, setName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')

  const selected = providers.find((p) => p.id === providerId)
  const local = selected ? localAccounts.find((l) => l.provider === selected.id) : undefined
  const items = providers.map((p) => ({
    value: p.id,
    label: p.implemented ? p.label : `${p.label} (coming soon)`,
  }))

  const choose = (id: ProviderId | null) => {
    const p = providers.find((x) => x.id === id)
    setProviderId(id)
    setName(p?.label ?? '')
    setBaseUrl(p?.baseUrl ?? '')
    setApiKey('')
  }

  const canAdd =
    !!selected &&
    selected.implemented &&
    (selected.auth === 'oauthLocal' ? !!local : apiKey.trim().length > 0)

  const add = async () => {
    if (!selected || !canAdd) return
    await addAccount({
      id: `${selected.id}-${Date.now().toString(36)}`,
      name: name.trim() || selected.label,
      provider: selected.id,
      apiKey: selected.auth === 'oauthLocal' ? undefined : apiKey.trim(),
      baseUrl: baseUrl.trim() || undefined,
    })
    choose(null)
  }

  return (
    <FieldSet>
      <FieldLegend>Accounts</FieldLegend>
      {accounts.length > 0 && (
        <ItemGroup className="gap-2">
          {accounts.map((a) => (
            <Item key={a.id} variant="outline" size="sm">
              <ItemMedia>
                <ProviderIcon provider={a.provider} size="sm" />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle className="truncate">{a.name}</ItemTitle>
              </ItemContent>
              <ItemActions>
                <Button variant="ghost" size="sm" onClick={() => removeAccount(a.id)} aria-label={`Remove ${a.name}`}>
                  Remove
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}

      <FieldGroup className="gap-4 rounded-lg border border-dashed p-3">
        <Field>
          <FieldLabel htmlFor="provider">Provider</FieldLabel>
          <Select items={items} value={providerId} onValueChange={(v) => choose(v as ProviderId | null)}>
            <SelectTrigger id="provider" className="w-full">
              <SelectValue placeholder="Select a provider…" />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem
                  key={item.value}
                  value={item.value}
                  disabled={!providers.find((p) => p.id === item.value)?.implemented}
                >
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected?.notes && <FieldDescription>{selected.notes}</FieldDescription>}
        </Field>

        {selected?.implemented && (
          <>
            <Field>
              <FieldLabel htmlFor="acct-name">Display name</FieldLabel>
              <Input id="acct-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={selected.label} />
            </Field>
            {selected.auth === 'oauthLocal' ? (
              <Alert>
                {local ? <CircleCheck aria-hidden /> : <Info aria-hidden />}
                <AlertDescription>
                  {local
                    ? `Detected a local ${selected.label} login${local.email ? ` (${local.email})` : ''}. No API key needed.`
                    : `No local ${selected.label} login found. Sign in with the ${selected.label} CLI, then reopen settings.`}
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Field>
                  <FieldLabel htmlFor="acct-key">API key</FieldLabel>
                  <Input
                    id="acct-key"
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter API key"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="acct-url">Base URL</FieldLabel>
                  <Input id="acct-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
                </Field>
              </>
            )}
            <Button onClick={add} disabled={!canAdd}>
              Add account
            </Button>
          </>
        )}
      </FieldGroup>
    </FieldSet>
  )
}
