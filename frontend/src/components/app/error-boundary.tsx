import { Component, type ErrorInfo, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

/** Keeps one failing page from blanking the whole app; resets when the page key changes. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Page crashed:', error, info.componentStack) }
  componentDidUpdate(prev: { resetKey: string }) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <Alert variant="destructive" role="alert">
        <TriangleAlert aria-hidden="true" /><AlertTitle>This page hit an unexpected error</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3"><span>{this.state.error.message}</span><Button size="xs" variant="outline" onClick={() => this.setState({ error: null })}>Try again</Button></AlertDescription>
      </Alert>
    )
  }
}
