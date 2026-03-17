import { Component } from 'react';

/**
 * Generic React error boundary.
 * Catches render errors in children and shows a fallback instead of a white screen.
 *
 * Usage:
 *   <ErrorBoundary label="Scorecard">
 *     <ThesisScorecardTab ... />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ''}]`, error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const label = this.props.label || 'this section';
      return (
        <div className="p-4 my-2 rounded border border-red-400/30 bg-red-400/5">
          <p className="text-red-400 font-bold text-sm mb-1">Something went wrong in {label}</p>
          <p className="text-xs text-slate-400 mb-3 font-mono break-all">
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={this.handleReset}
            className="text-xs px-3 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
