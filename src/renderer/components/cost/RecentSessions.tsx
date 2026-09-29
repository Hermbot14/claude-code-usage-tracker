import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { CostSession } from '@/types'
import { prettyModel, usd } from './format'

const SHOWN = 5

/** The latest sessions as a shadcn Table, five at first. Under 480px the
 *  date column goes, so the project name keeps enough room to be read. */
export function RecentSessions({ sessions }: { sessions: CostSession[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? sessions : sessions.slice(0, SHOWN)
  return (
    <section aria-labelledby="cost-sessions" className="flex flex-col gap-2">
      <h3 id="cost-sessions" className="text-xs font-medium text-muted-foreground">
        Recent sessions
      </h3>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="hidden w-24 min-[480px]:table-cell">Date</TableHead>
            <TableHead className="w-24">Model</TableHead>
            <TableHead>Project</TableHead>
            <TableHead className="w-24 text-right">Cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((s) => (
            <TableRow key={s.sessionId || `${s.date}-${s.cost}`}>
              <TableCell className="hidden font-mono text-xs text-muted-foreground tabular-nums min-[480px]:table-cell">
                {s.date}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{prettyModel(s.model)}</Badge>
              </TableCell>
              <TableCell className="truncate text-muted-foreground" title={s.project}>
                {s.project}
              </TableCell>
              <TableCell className="text-right font-mono font-medium tabular-nums">{usd(s.cost)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {sessions.length > SHOWN && (
        <Button variant="outline" size="sm" className="self-start" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : `Show all ${sessions.length}`}
        </Button>
      )}
    </section>
  )
}
