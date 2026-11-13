import { Info } from 'lucide-react'
import type { Address, Investigation } from '@/types'
import { Field, MaskedBadge, Section } from './shared'

const COUNTRY = new Intl.DisplayNames('en', { type: 'region' })
const country = (c?: string | null) => { try { return c ? COUNTRY.of(c.toUpperCase()) ?? c : null } catch { return c ?? null } }

function Block({ title, address, masked, absent }: { title: string; address: Address | null; masked: boolean; absent: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between gap-2"><h4 className="text-xs font-semibold">{title}</h4>{address && masked && <MaskedBadge what="This address" />}</div>
      {address ? <>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          <Field label="Address line 1" value={address.line1} /><Field label="Address line 2" value={address.line2} />
          <Field label="City / town" value={address.city} /><Field label="County / region" value={address.county} />
          <Field label="Postcode" value={address.postcode} mono /><Field label="Country" value={country(address.country)} />
        </dl>
        {address.source && <p className="mt-2 text-[10.5px] text-subtle">Source: {address.source}</p>}
      </> : <p className="text-[11px] text-subtle italic">{absent}</p>}
    </div>
  )
}

export function AddressCard({ data, ip }: { data: Investigation['addresses']; ip: Investigation['ip'] }) {
  const g = ip?.geo
  return (
    <Section title="Address & Location Details" subtitle="Each address type is a separate source and is never merged">
      <div className="space-y-2.5">
        <Block title="Customer registered address" address={data.customer} masked={data.masked} absent="No registered address held for this customer. Addresses appear only when supplied by an authorised source." />
        <Block title="Merchant address (registered / verified business)" address={data.merchant} masked={data.masked} absent="No verified business address held for this merchant. It is not inferred from the payment reference or the logo." />
        <div className="rounded-lg border border-sev-med/25 bg-sev-med/5 p-3">
          <h4 className="mb-2 text-xs font-semibold">IP geolocation <span className="font-normal text-sev-med">· estimate, not an address</span></h4>
          {g ? <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            <Field label="Estimated city" value={g.city} /><Field label="Region" value={g.region} /><Field label="Country" value={country(g.country)} />
            <Field label="Approx. latitude" value={g.lat != null ? g.lat.toFixed(2) : null} mono /><Field label="Approx. longitude" value={g.lon != null ? g.lon.toFixed(2) : null} mono />
          </dl> : <p className="text-[11px] text-subtle italic">No IP geolocation is available.</p>}
          <p className="mt-2 flex items-start gap-1.5 text-[10.5px] text-subtle"><Info className="mt-px size-3 shrink-0" aria-hidden="true" />Coordinates are rounded and describe the network's likely area, which can be tens of kilometres from the person.</p>
        </div>
      </div>
    </Section>
  )
}
