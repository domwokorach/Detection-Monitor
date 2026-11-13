import { ArrowLeftRight, BellRing, ClipboardCheck, Eye, FileText, Scale, FolderOpen, Map as MapIcon, LayoutDashboard, ScrollText, Settings, SlidersHorizontal } from 'lucide-react'
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarRail } from '@/components/ui/sidebar'
import { DetectionMonitorLogo } from '@/components/brand/DetectionMonitorLogo'
import { navigate, useApp } from '@/store/app'
import type { Page } from '@/types'

const MAIN: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'command', label: 'Overview', icon: LayoutDashboard },
  { id: 'alerts', label: 'Alerts', icon: BellRing },
  { id: 'transactions', label: 'Transaction Monitoring', icon: ArrowLeftRight },
  { id: 'map', label: 'UK Risk Map', icon: MapIcon },
  { id: 'investigations', label: 'Investigations', icon: ClipboardCheck },
  { id: 'cases', label: 'Cases', icon: FolderOpen },
  { id: 'inequality', label: 'City Inequality', icon: Scale },
]
const ADMIN: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'rules', label: 'Risk Rules', icon: SlidersHorizontal },
  { id: 'watchlist', label: 'Watchlist', icon: Eye },
  { id: 'audit', label: 'Audit History', icon: ScrollText },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
]

function Item({ id, label, icon: Icon, badge }: (typeof MAIN)[number] & { badge?: number }) {
  const { page } = useApp()
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={page === id} tooltip={label} onClick={() => navigate(id)} aria-current={page === id ? 'page' : undefined}
        className="data-active:bg-primary/12 data-active:text-hl data-active:shadow-[inset_2px_0_0_var(--primary)]">
        <Icon aria-hidden="true" /><span>{label}</span>
      </SidebarMenuButton>
      {!!badge && <SidebarMenuBadge className="text-sev-crit">{badge}<span className="sr-only"> open alerts</span></SidebarMenuBadge>}
    </SidebarMenuItem>
  )
}

export function AppSidebar() {
  const { overview } = useApp()
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <DetectionMonitorLogo collapseWithSidebar className="px-0 py-0.5" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Monitor</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{MAIN.map(i => <Item key={i.id} {...i} badge={i.id === 'alerts' ? overview?.open_alerts : undefined} />)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Govern</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{ADMIN.map(i => <Item key={i.id} {...i} />)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-3 pb-3 text-[10px] text-subtle group-data-[collapsible=icon]:hidden">UK banking · FastAPI · PostgreSQL · Redis</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
