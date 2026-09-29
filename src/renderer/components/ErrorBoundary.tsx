import { Component, type ErrorInfo, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

/** Catches a renderer crash and offers a reload instead of a blank window. */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Renderer crash caught by ErrorBoundary:', error)
    console.error('Component stack:', errorInfo.componentStack)
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlert aria-hidden />
          </EmptyMedia>
          <EmptyTitle>
            <h2>Something went wrong</h2>
          </EmptyTitle>
          <EmptyDescription>The application hit an error and had to stop this view.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {this.state.error && (
            <details className="w-full max-w-md rounded-lg border bg-muted p-3 text-left text-xs">
              <summary className="cursor-pointer">Error details</summary>
              <pre className="mt-2 font-mono break-words whitespace-pre-wrap">{this.state.error.toString()}</pre>
            </details>
          )}
          <Button onClick={() => window.location.reload()}>Reload application</Button>
        </EmptyContent>
      </Empty>
    )
  }
}
