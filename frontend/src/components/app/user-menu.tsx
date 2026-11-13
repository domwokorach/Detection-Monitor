import { ChevronDown, LogOut, ScrollText, Settings, ShieldCheck, UserRound } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { navigate, openSettings, signOut, useApp } from '@/store/app'

const ROLE: Record<string, string> = { admin: 'Administrator', analyst: 'Analyst' }
const initialsOf = (name?: string) => (name ?? '?').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
const item = 'cursor-pointer rounded-[5px] px-2 py-1.5 text-[13px] transition-colors duration-200'

/** Top-right account menu: profile summary trigger plus navigation and sign-out actions. */
export function UserMenu() {
  const { user } = useApp()
  if (!user) return null
  const initials = initialsOf(user.display_name)
  const avatar = (
    <Avatar className="size-9">
      {user.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
      <AvatarFallback className="bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">{initials}</AvatarFallback>
    </Avatar>
  )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${user.display_name}`}
        className="group/user flex items-center gap-2.5 rounded-[5px] py-0.5 pr-1.5 pl-0.5 outline-none transition-colors duration-200 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted">
        {avatar}
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-[13px] font-semibold" style={{ fontFamily: "'Geist Variable', ui-sans-serif, system-ui, sans-serif" }}>{user.display_name}</span>
          <span className="block text-[11px] text-muted-foreground">{user.email}</span>
        </span>
        <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]/user:rotate-180 motion-reduce:transition-none" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-[5px] p-1.5">
        <DropdownMenuLabel className="flex items-center gap-3 p-2 font-normal">
          {avatar}
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[13px] font-semibold text-foreground">{user.display_name}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{user.email}</span>
            <span className="mt-1 inline-block rounded-[5px] border border-primary/30 bg-primary/10 px-1.5 py-px text-[10px] font-medium text-primary">{ROLE[user.role] ?? user.role}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem className={item} onSelect={() => openSettings('profile')}><UserRound aria-hidden="true" />My Profile</DropdownMenuItem>
          <DropdownMenuItem className={item} onSelect={() => openSettings('notifications')}><Settings aria-hidden="true" />Account Settings</DropdownMenuItem>
          <DropdownMenuItem className={item} onSelect={() => openSettings('security')}><ShieldCheck aria-hidden="true" />Security Settings</DropdownMenuItem>
          <DropdownMenuItem className={item} onSelect={() => navigate('audit')}><ScrollText aria-hidden="true" />Audit Activity</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" className={item} onSelect={() => void signOut()}><LogOut aria-hidden="true" />Sign Out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
