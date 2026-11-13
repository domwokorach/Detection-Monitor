import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { openAlert } from '@/store/app'
import { CaseView } from './case-view'

/** Analyst review sheet: slides over the queue so the analyst keeps their place. */
export function AlertSheet({ alertId, onClose }: { alertId: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!alertId} onOpenChange={o => { if (!o) onClose() }}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b"><SheetTitle>Alert investigation</SheetTitle><SheetDescription>Review evidence, assign, escalate or resolve.</SheetDescription>{alertId && <Button size="xs" variant="outline" className="mt-2 w-fit" onClick={() => { const id = alertId; onClose(); openAlert(id) }}>Open full investigation</Button>}</SheetHeader>
        <ScrollArea className="min-h-0 flex-1"><div className="p-4">{alertId && <CaseView alertId={alertId} />}</div></ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
