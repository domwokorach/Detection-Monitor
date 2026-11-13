import { useMemo, useState } from 'react'
import { Activity, Bell, Search } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Kbd } from '@/components/ui/kbd'
import { navigate, openAlert, set, useApp } from '@/store/app'
import { relative } from '@/lib/format'
import { RiskBadge } from './common'
import { DetectionMonitorLogo } from '@/components/brand/DetectionMonitorLogo'
import { UserMenu } from './user-menu'
import { ThemeToggle } from './theme-toggle'

export function Topbar() {
  const { demo, live, lastUpdated, alerts, search } = useApp()
  const [seenAt, setSeenAt] = useState(() => Date.now())
  const [open, setOpen] = useState(false)
  const recent = useMemo(() => alerts.filter(a => a.status !== 'CLOSED').slice(0, 6), [alerts])
  const unread = recent.filter(a => +new Date(a.created_at) > seenAt).length
  return (
    <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur">
      <SidebarTrigger aria-label="Toggle sidebar" />
      <DetectionMonitorLogo size={30} showName={false} className="md:hidden" />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <InputGroup className="h-8 max-w-sm flex-1">
        <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
        <InputGroupInput value={search} aria-label="Search transactions" placeholder="Search transactions, counterparties…"
          onChange={e => set({ search: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') navigate('transactions') }} />
        <InputGroupAddon align="inline-end"><Kbd>↵</Kbd></InputGroupAddon>
      </InputGroup>
      <div className="ml-auto flex items-center gap-2">
        <Badge variant="outline" className="hidden gap-1.5 font-normal text-muted-foreground sm:inline-flex" role="status" title={lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString('en-GB')}` : ''}>
          <Activity className={live ? 'text-ok' : 'text-sev-med'} aria-hidden="true" />{live ? (demo ? 'Simulated feed' : 'Live monitoring') : 'Reconnecting…'}
        </Badge>
        <ThemeToggle />
        <Popover open={open} onOpenChange={o => { setOpen(o); if (!o) setSeenAt(Date.now()) }}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="relative" aria-label="Notifications"><Bell aria-hidden="true" />
              {unread > 0 && <span className="absolute -top-1 -right-1 grid min-w-3.5 place-items-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">{unread}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-1.5">
            <p className="px-2.5 py-1.5 text-[10px] font-semibold tracking-wider text-subtle uppercase">Open alerts</p>
            {!recent.length && <p className="px-2.5 pb-3 text-xs text-muted-foreground">You're all caught up.</p>}
            {recent.map(a => (
              <button key={a.id} className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { setOpen(false); openAlert(a.id) }}>
                <span className="min-w-0"><span className="block truncate text-xs">{a.transaction.counterparty}</span><span className="block text-[10px] text-subtle">{relative(a.created_at)}</span></span><RiskBadge score={a.risk_score} />
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <UserMenu />
      </div>
    </header>
  )
}
