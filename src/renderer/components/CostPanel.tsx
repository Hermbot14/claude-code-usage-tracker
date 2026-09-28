import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import type { CostSummary } from '@/types'
import { useInterval } from '@hooks/useInterval'
import { CostStats } from './cost/CostStats'
import { ProjectSpend } from './cost/ProjectSpend'
import { RecentSessions } from './cost/RecentSessions'
import { usd } from './cost/format'

/**
 * API-equivalent cost: what this machine's Claude Code usage would have cost
 * on pay-as-you-go API billing. On a coding plan none of it is charged; it
 * shows the value of the plan and the shape of the spend.
 *
 * Figures come from the main process, which reprices the raw token counts
 * in ~/.claude/metrics/costs.jsonl rather than trusting the cost the logging
 * hook wrote (see src/main/cost-service.ts).
 */

const REFRESH_MS = 60_000

function Heading() {
  return (
    <CardHeader>
      <CardTitle>
        <h2>API-equivalent cost</h2>
      </CardTitle>
      <CardDescription>
        What this usage would cost on pay-as-you-go billing. Your plan covers it.
      </CardDescription>
    </CardHeader>
  )
}

export function CostPanel() {
  const [summary, setSummary] = useState<CostSummary | null>(null)

  const load = useCallback(() => {
    window.api
      .getCostSummary()
      .then(setSummary)
      .catch(() => {
        // The main handler never rejects; a transient IPC failure is retried
        // on the next interval.
      })
  }, [])

  useEffect(() => load(), [load])
  useInterval(load, REFRESH_MS)

  // Before the first reply: hold the panel's height steady.
  if (!summary) {
    return (
      <Card aria-busy>
        <Heading />
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    )
  }

  if (!summary.available) {
    return (
      <Card>
        <Heading />
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {summary.reason ?? 'Cost data is unavailable.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  // The ledger's own figure is usually inflated (stale rates). Only say so
  // when the gap is material, so the note does not become permanent noise.
  const overstatement = summary.ledgerReportedTotal - summary.total
  const showCorrection =
    summary.total > 0 && summary.ledgerReportedTotal > 0 && overstatement / summary.total > 0.05

  return (
    <Card>
      <Heading />
      <CardContent className="flex flex-col gap-5">
        <CostStats summary={summary} />
        {summary.byProject.length > 0 && (
          <>
            <Separator />
            <ProjectSpend projects={summary.byProject.slice(0, 5)} />
          </>
        )}
        {summary.sessions.length > 0 && <RecentSessions sessions={summary.sessions} />}
        {showCorrection && (
          <p className="text-xs text-muted-foreground">
            Repriced from raw token counts. The logging hook&rsquo;s own figure of{' '}
            {usd(summary.ledgerReportedTotal)} overstates this by {usd(overstatement)}, because it
            prices Opus at legacy rates.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
