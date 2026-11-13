import { useCallback, useEffect, useState } from 'react'
import { ErrorState } from '@/components/app/common'
import { Skeleton } from '@/components/ui/skeleton'
import { api, useApp } from '@/store/app'
import type { AlertDetail, Investigation } from '@/types'
import { AddressCard } from './address-card'
import { GeoCard } from './geo-card'
import { IpCard } from './ip-card'
import { Overview } from './overview'
import { RiskCard } from './risk-card'
import { TimeCard } from './time-card'
import { TimelineCard } from './timeline-card'

type Data = { inv: Investigation; detail: AlertDetail }

/** Full investigation workspace for one alert. Personal data arrives already masked for the caller's role. */
export function InvestigationDetail({ alertId }: { alertId: string }) {
  const { alerts } = useApp()
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [inv, detail] = await Promise.all([api().investigation(alertId), api().alert(alertId)])
      setData({ inv, detail }); setError('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load investigation') } finally { setLoading(false) }
  }, [alertId])
  useEffect(() => { setData(null); void load() }, [load])
  const stamp = alerts.find(a => a.id === alertId)?.updated_at
  useEffect(() => { if (stamp) void load(true) }, [stamp]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !data) return <div className="space-y-3" aria-busy="true" aria-label="Loading investigation"><Skeleton className="h-44" /><div className="grid gap-3 xl:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div><Skeleton className="h-56" /></div>
  if (error && !data) return <ErrorState message={error} onRetry={() => void load()} />
  if (!data) return null
  const { inv, detail } = data
  return (
    <div className="space-y-3">
      {error && <ErrorState message={error} onRetry={() => void load(true)} />}
      <Overview inv={inv} detail={detail} onChanged={() => void load(true)} />
      <div className="grid gap-3 xl:grid-cols-2">
        <IpCard ip={inv.ip} />
        <GeoCard ip={inv.ip} points={inv.related_points} />
        <TimeCard t={inv.timestamps} />
        <AddressCard data={inv.addresses} ip={inv.ip} />
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <RiskCard inv={inv} detail={detail} />
        <TimelineCard items={inv.timeline} />
      </div>
    </div>
  )
}
