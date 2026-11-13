import { useState } from 'react'
import { motion } from 'motion/react'
import { ChevronDown, History, Lock, Pencil, Plus, SlidersHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { RuleDialog } from '@/components/app/rule-dialog'
import { AuditTimeline } from '@/components/app/audit-timeline'
import { CountUp, EmptyState, ErrorState, Mono, PageHeader } from '@/components/app/common'
import { api, guarded, isAdmin, refresh, useApp } from '@/store/app'
import { relative, titleCase } from '@/lib/format'
import type { Rule } from '@/types'

export default function Rules() {
  const app = useApp()
  const { rules, ruleStats, audit, loaded, error } = app
  const admin = isAdmin(app)
  const [dialog, setDialog] = useState<{ open: boolean; rule: Rule | null }>({ open: false, rule: null })
  const stat = (c: string) => ruleStats.find(s => s.rule_code === c)
  const max = Math.max(1, ...ruleStats.map(s => s.matches))
  const loading = !loaded && !error
  const toggle = (r: Rule, enabled: boolean) => guarded(() => api().updateRule(r.id, { expected_version: r.version, enabled }), `${r.name} ${enabled ? 'enabled' : 'disabled'}`)
  return (
    <div>
      <PageHeader title="Risk Rules Engine" description={`${rules.filter(r => r.enabled).length} of ${rules.length} rules active · scores add up across matching rules`}
        actions={admin ? <Button size="sm" onClick={() => setDialog({ open: true, rule: null })}><Plus data-icon="inline-start" />New rule</Button> : <Badge variant="outline" className="gap-1 font-normal text-muted-foreground"><Lock className="size-3" aria-hidden="true" />Read-only · admin access required to edit</Badge>} />
      {error && !loaded && <ErrorState message={error} onRetry={() => refresh()} />}
      {loading ? <div className="grid gap-3 lg:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-44 rounded-[10px]" />)}</div>
        : !rules.length ? <EmptyState icon={SlidersHorizontal} title="No rules configured" body="Create a rule to start flagging suspicious transactions." />
        : (
          <div className="grid items-start gap-3 lg:grid-cols-2">{rules.map((r, i) => {
            const s = stat(r.code), history = audit.filter(e => e.entity_type === 'rule' && e.entity_id === r.id)
            return (
              <motion.div key={r.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: i * 0.05 }}>
                <Card className={`dash-card gap-3 p-4 ${r.enabled ? '' : 'opacity-70'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><Mono className="text-primary">{r.code} · v{r.version}</Mono><h3 className="mt-1 text-sm font-semibold">{r.name}</h3><p className="mt-0.5 text-xs text-muted-foreground">{r.description || titleCase(r.kind)}</p></div>
                    <Tooltip><TooltipTrigger asChild><span><Switch checked={r.enabled} disabled={!admin} aria-label={`${r.name} enabled`} onCheckedChange={v => toggle(r, v)} /></span></TooltipTrigger><TooltipContent>{admin ? (r.enabled ? 'Disable rule' : 'Enable rule') : 'Admin only'}</TooltipContent></Tooltip>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-[11px]">
                    <div><p className="text-subtle">Weight</p><p className="mt-0.5 text-lg font-semibold tnum">+{r.weight}</p></div>
                    <div><p className="text-subtle">Matches</p><p className="mt-0.5 text-lg font-semibold"><CountUp value={s?.matches ?? 0} /></p></div>
                    <div><p className="text-subtle">Last matched</p><p className="mt-1 text-xs">{s?.last_matched_at ? relative(s.last_matched_at) : 'Never'}</p></div>
                  </div>
                  <Progress value={((s?.matches ?? 0) / max) * 100} className="h-1" aria-label={`${r.name} match share`} />
                  <Collapsible>
                    <div className="flex items-center justify-between">
                      <CollapsibleTrigger asChild><Button size="xs" variant="ghost" className="group"><ChevronDown className="transition-transform group-data-[state=open]:rotate-180" data-icon="inline-start" />Configuration &amp; history ({history.length})</Button></CollapsibleTrigger>
                      {admin && <Button size="xs" variant="outline" onClick={() => setDialog({ open: true, rule: r })}><Pencil data-icon="inline-start" />Edit</Button>}
                    </div>
                    <CollapsibleContent className="mt-3 space-y-3">
                      <dl className="space-y-1 rounded-lg border bg-secondary/40 p-3 text-[11px]">
                        {Object.entries(r.config).map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="text-subtle">{titleCase(k)}</dt><dd className="tech">{Array.isArray(v) ? v.join(', ') : String(v)}</dd></div>)}
                        <div className="flex justify-between gap-4"><dt className="text-subtle">Updated</dt><dd>{relative(r.updated_at)}</dd></div>
                      </dl>
                      <div><p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><History className="size-3" aria-hidden="true" />Version history</p>
                        {history.length ? <AuditTimeline events={history} /> : <p className="text-[11px] text-subtle">No recorded changes.</p>}</div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              </motion.div>) })}</div>)}
      <RuleDialog open={dialog.open} rule={dialog.rule} onOpenChange={o => setDialog(d => ({ ...d, open: o }))} />
    </div>
  )
}
