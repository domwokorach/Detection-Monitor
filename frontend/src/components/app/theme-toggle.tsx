import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useTheme, type ThemeMode } from '@/hooks/use-theme'

const OPTIONS: { id: ThemeMode; label: string; icon: typeof Moon }[] = [{ id: 'dark', label: 'Dark', icon: Moon }, { id: 'light', label: 'Light', icon: Sun }, { id: 'system', label: 'System', icon: Monitor }]

export function ThemeToggle() {
  const { mode, setMode } = useTheme()
  const Current = OPTIONS.find(o => o.id === mode)!.icon
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label={`Theme: ${mode}`}><Current aria-hidden="true" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuRadioGroup value={mode} onValueChange={v => setMode(v as ThemeMode)}>
          {OPTIONS.map(o => <DropdownMenuRadioItem key={o.id} value={o.id}><o.icon aria-hidden="true" />{o.label}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
