import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface-alt">
          <div className="max-w-md rounded-xl bg-surface p-8 text-center shadow-lg">
            <h2 className="mb-2 text-xl font-semibold text-text">
              Something went wrong
            </h2>
            <p className="mb-4 text-text-muted">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-primary px-4 py-2 text-white transition-colors hover:bg-primary-hover"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
