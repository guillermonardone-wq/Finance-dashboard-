import { Component } from 'react';

/**
 * Root-level error boundary wrapping the entire application.
 * Catches any unhandled render errors and shows a recovery UI
 * instead of a white screen. In development, shows the stack trace.
 *
 * The existing ErrorBoundary on ThesisDetail tabs stays as defense in depth.
 */
export default class RootErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[RootErrorBoundary]', error, errorInfo.componentStack);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const isDev = import.meta.env.DEV;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: '#e2e8f0',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '2rem',
        }}
      >
        <div style={{ maxWidth: '600px', width: '100%' }}>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#f87171',
              marginBottom: '0.5rem',
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: '0.875rem',
              color: '#94a3b8',
              marginBottom: '1rem',
            }}
          >
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>

          {isDev && this.state.errorInfo && (
            <pre
              style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                backgroundColor: '#1e293b',
                padding: '1rem',
                borderRadius: '0.5rem',
                overflow: 'auto',
                maxHeight: '300px',
                marginBottom: '1rem',
                border: '1px solid #334155',
              }}
            >
              {this.state.error?.stack}
              {'\n\nComponent Stack:'}
              {this.state.errorInfo.componentStack}
            </pre>
          )}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Reload Application
            </button>
            <a
              href="/"
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#1e293b',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: '0.375rem',
                textDecoration: 'none',
                fontSize: '0.875rem',
              }}
            >
              Go Home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
