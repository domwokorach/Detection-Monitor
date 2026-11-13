import { lazy, Suspense, useEffect } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { FlaskConical } from 'lucide-react'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { AppSidebar } from '@/components/app/app-sidebar'
import { DashboardFooter } from '@/components/app/DashboardFooter'
import { Topbar } from '@/components/app/topbar'
import { ErrorBoundary } from '@/components/app/error-boundary'
import Login from '@/pages/login'
import { logout, useApp } from '@/store/app'
import { useTheme } from '@/hooks/use-theme'
import type { Page } from '@/types'

const pages: Record<Page, React.LazyExoticComponent<() => React.JSX.Element>> = {
  command: lazy(() => import('@/pages/command-center')), transactions: lazy(() => import('@/pages/transactions')), map: lazy(() => import('@/pages/risk-map')), alerts: lazy(() => import('@/pages/alerts')),
  rules: lazy(() => import('@/pages/rules')), investigations: lazy(() => import('@/pages/investigations')), audit: lazy(() => import('@/pages/audit')), cases: lazy(() => import('@/pages/cases')), watchlist: lazy(() => import('@/pages/watchlist')), reports: lazy(() => import('@/pages/reports')), inequality: lazy(() => import('@/pages/inequality')), settings: lazy(() => import('@/pages/settings')),
  terms: lazy(() => import('@/pages/TermsPage')), privacy: lazy(() => import('@/pages/PrivacyPage')), security: lazy(() => import('@/pages/SecurityPage')), accessibility: lazy(() => import('@/pages/AccessibilityPage')),
}
const TITLES: Record<Page, string> = { command: 'Operational Overview', transactions: 'Transaction Monitoring', map: 'UK Risk Map', alerts: 'Suspicious Alerts', rules: 'Risk Rules Engine', investigations: 'Investigations', cases: 'Cases', watchlist: 'Watchlist', reports: 'Reports', inequality: 'UK City Inequality', audit: 'Audit History', settings: 'Settings', terms: 'Terms & Conditions', privacy: 'Privacy Policy', security: 'Risk & Security', accessibility: 'Accessibility' }

export default function App() {
  const { user, demo, page } = useApp()
  const { resolved } = useTheme()
  useEffect(() => { document.title = `${TITLES[page]} · Detection Monitor`; window.scrollTo({ top: 0 }) }, [page])
  // Strict 5px geometry on the Alerts page; portals (sheet, tooltip) render outside the page so the class lives on <html>.
  useEffect(() => { document.documentElement.classList.toggle('alerts-sharp', page === 'alerts' || page === 'inequality' || page === 'investigations'); return () => document.documentElement.classList.remove('alerts-sharp') }, [page])
  const Page = pages[page]
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={150}>
        {!user ? <Login /> : (
          <SidebarProvider>
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">Skip to content</a>
            <AppSidebar />
            <SidebarInset>
              <Topbar />
              {demo && <div className="flex items-center justify-center gap-2 border-b border-sev-med/20 bg-sev-med/10 px-4 py-1 text-[11px] text-sev-med" role="status"><FlaskConical className="size-3" aria-hidden="true" /><strong>Demo data</strong> — simulated, stored in memory only.<button className="underline underline-offset-2 hover:text-foreground" onClick={logout}>Exit demo</button></div>}
              <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1600px] flex-1 p-4 outline-none lg:p-5">
                <AnimatePresence mode="wait">
                  <motion.div key={page} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
                    <ErrorBoundary resetKey={page}><Suspense fallback={<div className="space-y-3" aria-busy="true"><Skeleton className="h-8 w-64" /><Skeleton className="h-28" /><Skeleton className="h-64" /></div>}><Page /></Suspense></ErrorBoundary>
                  </motion.div>
                </AnimatePresence>
              </main>
              <DashboardFooter />
            </SidebarInset>
          </SidebarProvider>
        )}
        <Toaster theme={resolved} position="bottom-right" />
      </TooltipProvider>
    </MotionConfig>
  )
}
