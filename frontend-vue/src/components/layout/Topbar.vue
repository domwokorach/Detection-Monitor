<script setup lang="ts">
import { computed, ref } from 'vue'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent, DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from 'reka-ui'
import { Bell, Menu, LogOut, ChevronDown, Activity, UserRound, Settings, ShieldCheck, ScrollText } from 'lucide-vue-next'
import { data, demo, signOut, navigate, notificationsSeenAt, openAlert, page, status, user } from '@/stores/app'
import { TOP_TABS } from '@/lib/nav'
import { relative } from '@/lib/format'
import RiskBadge from '@/components/ui/RiskBadge.vue'
import DetectionMonitorLogo from '@/components/brand/DetectionMonitorLogo.vue'
import ThemeToggle from '@/components/layout/ThemeToggle.vue'

defineEmits<{ 'open-menu': [] }>()
const itemCls = 'flex cursor-pointer items-center gap-2 rounded-[5px] px-2.5 py-2 text-[13px] text-fg outline-none transition-colors duration-200 data-[highlighted]:bg-white/[0.08]'
const MENU = [
  { label: 'My Profile', page: 'settings', icon: UserRound }, { label: 'Account Settings', page: 'settings', icon: Settings },
  { label: 'Security Settings', page: 'settings', icon: ShieldCheck }, { label: 'Audit Activity', page: 'audit', icon: ScrollText },
] as const
const bellOpen = ref(false)
const recent = computed(() => data.alerts.filter(a => a.status !== 'CLOSED').slice(0, 6))
const unread = computed(() => recent.value.filter(a => +new Date(a.created_at) > notificationsSeenAt.value).length)
function onBell(open: boolean) { bellOpen.value = open; if (!open) notificationsSeenAt.value = Date.now() }
const initials = computed(() => (user.value?.display_name ?? '?').split(' ').map(w => w[0]).slice(0, 2).join(''))
</script>

<template>
  <header class="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-ink-900/90 px-4 backdrop-blur lg:px-6">
    <button class="focus-ring rounded-md p-2 text-fg2 hover:bg-white/10 lg:hidden" aria-label="Open navigation" @click="$emit('open-menu')"><Menu :size="18" /></button>
    <DetectionMonitorLogo :size="30" :show-name="false" class="lg:hidden" />

    <nav class="hidden items-center gap-0.5 rounded-lg border border-line bg-ink-800 p-1 md:flex" aria-label="Sections">
      <button v-for="t in TOP_TABS" :key="t.label" class="focus-ring rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200"
        :class="page === t.id ? 'border border-accent/40 bg-accent/10 text-hl shadow-[0_0_14px_-4px_rgb(101_185_238/0.5)]' : 'border border-transparent text-fg2 hover:text-fg'"
        :aria-current="page === t.id ? 'page' : undefined" @click="navigate(t.id)">{{ t.label }}</button>
    </nav>

    <div class="ml-auto flex items-center gap-2">
      <div class="hidden items-center gap-2 rounded-md border border-line px-2.5 py-1.5 text-[11px] text-fg2 lg:flex" role="status" :title="status.lastUpdated ? `Last updated ${status.lastUpdated.toLocaleTimeString()}` : ''">
        <Activity :size="12" :class="status.live ? 'text-ok' : 'text-sev-med'" aria-hidden="true" />
        {{ status.live ? (demo ? 'Simulated feed' : 'Live monitoring') : 'Reconnecting…' }}
      </div>

      <ThemeToggle />

      <PopoverRoot :open="bellOpen" @update:open="onBell">
        <PopoverTrigger class="focus-ring relative grid size-8 place-items-center rounded-md border border-line bg-ink-800 text-fg2 transition-colors hover:text-fg" aria-label="Notifications">
          <Bell :size="15" />
          <span v-if="unread" class="absolute -top-1 -right-1 grid min-w-3.5 place-items-center rounded-full bg-ok px-1 text-[9px] font-semibold text-ink-950">{{ unread }}</span>
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent align="end" :side-offset="8" class="z-50 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-line bg-ink-700 p-1.5 shadow-2xl">
            <p class="px-3 py-2 text-[10px] font-semibold tracking-wider text-fg3 uppercase">Open alerts</p>
            <p v-if="!recent.length" class="px-3 pb-4 text-xs text-fg2">You're all caught up.</p>
            <button v-for="a in recent" :key="a.id" class="focus-ring flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left hover:bg-white/[0.06]" @click="bellOpen = false; openAlert(a.id)">
              <span class="min-w-0"><span class="block truncate text-xs text-fg">{{ a.transaction.counterparty }}</span><span class="block text-[10px] text-fg3">{{ relative(a.created_at) }}</span></span>
              <RiskBadge :score="a.risk_score" />
            </button>
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>

      <DropdownMenuRoot>
        <DropdownMenuTrigger class="focus-ring group/user flex items-center gap-2.5 rounded-[5px] py-0.5 pr-1.5 pl-0.5 transition-colors duration-200 hover:bg-white/[0.06] data-[state=open]:bg-white/[0.06]" :aria-label="`Account menu for ${user?.display_name}`">
          <span class="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-accent to-ice text-xs font-semibold text-ink-950">
            <img v-if="user?.avatar_url" :src="user.avatar_url" alt="" class="size-full object-cover" /><template v-else>{{ initials }}</template>
          </span>
          <span class="hidden text-left leading-tight sm:block">
            <span class="block text-[13px] font-semibold text-fg" style="font-family: 'Geist', 'Inter', ui-sans-serif, system-ui, sans-serif">{{ user?.display_name }}</span>
            <span class="block text-[11px] text-fg3">{{ user?.email }}</span>
          </span>
          <ChevronDown :size="14" class="text-fg3 transition-transform duration-200 group-data-[state=open]/user:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent align="end" :side-offset="8" class="z-50 w-64 rounded-[5px] border border-line bg-ink-700 p-1.5 shadow-2xl">
            <DropdownMenuLabel class="flex items-center gap-3 p-2">
              <span class="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-accent to-ice text-xs font-semibold text-ink-950">
                <img v-if="user?.avatar_url" :src="user.avatar_url" alt="" class="size-full object-cover" /><template v-else>{{ initials }}</template>
              </span>
              <span class="min-w-0 leading-tight">
                <span class="block truncate text-[13px] font-semibold text-fg">{{ user?.display_name }}</span>
                <span class="block truncate text-[11px] text-fg2">{{ user?.email }}</span>
                <span class="mt-1 inline-block rounded-[5px] border border-accent/30 bg-accent/10 px-1.5 py-px text-[10px] font-medium text-hl">{{ user?.role === 'admin' ? 'Administrator' : 'Analyst' }}</span>
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator class="my-1 h-px bg-line" />
            <DropdownMenuItem v-for="m in MENU" :key="m.label" :class="itemCls" @select="navigate(m.page)"><component :is="m.icon" :size="14" aria-hidden="true" />{{ m.label }}</DropdownMenuItem>
            <DropdownMenuSeparator class="my-1 h-px bg-line" />
            <DropdownMenuItem :class="[itemCls, 'text-sev-crit']" @select="signOut"><LogOut :size="14" aria-hidden="true" />Sign Out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>
  </header>
</template>
