import { useMemo } from 'react'
import { motion } from 'motion/react'
import { Eye } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState, Mono, PageHeader, RiskBadge } from '@/components/app/common'
import { navigate, refresh, useApp } from '@/store/app'
import { watchlistCountries } from '@/lib/dashboard'
import { dateTime, money } from '@/lib/format'
import { WatchlistHitsStepChart } from '@/components/app/WatchlistHitsStepChart'

export default function Watchlist() {
  const { rules, transactions, loaded, error } = useApp()
  const loading = !loaded && !error
  const countries = useMemo(() => [...watchlistCountries(rules)].sort(), [rules])
  const hits = useMemo(() => transactions.filter(t => countries.includes(t.country)).sort((a, b) => +new Date(b.occurred_at) - +new Date(a.occurred_at)), [transactions, countries])
  return (
    <div>
      <PageHeader title="Watchlist" description="Jurisdictions under enhanced monitoring, sourced from active watchlist rules" />
      {error && !loaded && <ErrorState message={error} onRetry={() => refresh()} />}
      <div className="mb-3"><WatchlistHitsStepChart /></div>
      <div className="grid gap-3 lg:grid-cols-4">
        <Card className="dash-card gap-2 py-3 lg:col-span-1">
          <CardHeader className="px-3.5"><CardTitle className="text-[13px]">Monitored Jurisdictions</CardTitle><CardDescription className="text-[11px]">Managed under Risk Rules</CardDescription></CardHeader>
          <CardContent className="space-y-1.5 px-3.5">
            {loading ? <Skeleton className="h-20" /> : !countries.length ? <p className="py-6 text-center text-[11px] text-subtle">No active watchlist rule</p>
              : countries.map((c, i) => (
                <motion.div key={c} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between rounded-md border bg-background/40 px-2.5 py-2">
                  <Mono className="text-hl">{c}</Mono><span className="tnum text-[11px] text-muted-foreground">{hits.filter(t => t.country === c).length} transactions</span>
                </motion.div>))}
            <button className="pt-1 text-[11px] text-primary underline-offset-2 hover:underline" onClick={() => navigate('rules')}>Manage watchlist rule</button>
          </CardContent>
        </Card>
        <Card className="dash-card gap-2 p-2 lg:col-span-3">
          <CardHeader className="px-2"><CardTitle className="text-[13px]">Watchlist Activity</CardTitle><CardDescription className="text-[11px]">Transactions involving a monitored jurisdiction</CardDescription></CardHeader>
          {loading ? <Skeleton className="m-2 h-40" /> : !hits.length ? <EmptyState icon={Eye} title="No watchlist activity" body="Transactions to monitored jurisdictions will appear here." /> : (
            <Table><TableHeader><TableRow><TableHead>Transaction</TableHead><TableHead>Counterparty</TableHead><TableHead>Country</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Risk</TableHead><TableHead>Time</TableHead></TableRow></TableHeader>
              <TableBody>{hits.slice(0, 25).map(t => (
                <TableRow key={t.id} className="transition-transform hover:translate-x-0.5"><TableCell><Mono>{t.external_id}</Mono></TableCell><TableCell className="text-[12px]">{t.counterparty}</TableCell><TableCell><Mono>{t.country}</Mono></TableCell>
                  <TableCell className="text-right tnum">{money(Number(t.amount), t.currency)}</TableCell><TableCell><RiskBadge score={t.risk_score} /></TableCell><TableCell className="tech text-[11px] text-muted-foreground">{dateTime(t.occurred_at)}</TableCell></TableRow>))}</TableBody></Table>)}
        </Card>
      </div>
    </div>
  )
}
