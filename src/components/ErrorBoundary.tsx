import { Component, ReactNode } from 'react';

type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Lumora IT crash:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#030712' }}>
          <div className="max-w-md text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl font-bold"
              style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#0a0301' }}>
              L
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-400 mb-4">
              The app hit an unexpected error. Reloading usually fixes it.
            </p>
            <pre className="text-xs text-red-400 bg-slate-800/50 rounded-xl p-3 mb-4 text-left overflow-auto max-h-40">
              {this.state.error?.message || 'Unknown error'}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-xl font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#0a0301' }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
