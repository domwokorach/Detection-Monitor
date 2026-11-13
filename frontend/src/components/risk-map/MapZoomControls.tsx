import { Maximize2, Minus, Plus } from 'lucide-react'

const btn = 'grid size-8 place-items-center text-[#BFE8FF] outline-none transition-colors hover:bg-[#12304A] focus-visible:ring-2 focus-visible:ring-[#65B9EE] disabled:opacity-40'

export function MapZoomControls({ onZoomIn, onZoomOut, onReset, canZoomIn, canZoomOut }: { onZoomIn: () => void; onZoomOut: () => void; onReset: () => void; canZoomIn: boolean; canZoomOut: boolean }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[5px] border border-[#1B344D] bg-[#0B1E33]/95 shadow-lg backdrop-blur" role="group" aria-label="Map zoom">
      <button className={btn} onClick={onZoomIn} disabled={!canZoomIn} aria-label="Zoom in"><Plus className="size-4" aria-hidden="true" /></button>
      <button className={`${btn} border-y border-[#1B344D]`} onClick={onZoomOut} disabled={!canZoomOut} aria-label="Zoom out"><Minus className="size-4" aria-hidden="true" /></button>
      <button className={btn} onClick={onReset} aria-label="Reset map view" title="Reset map view"><Maximize2 className="size-3.5" aria-hidden="true" /></button>
    </div>
  )
}
