import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl border-2 border-red-400 m-4 shadow-xl">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-950 text-red-600 rounded-full flex items-center justify-center shadow-inner">
              <AlertCircle className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              {this.props.fallbackTitle || 'Something went wrong in this section'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            {this.state.errorInfo?.componentStack && (
              <details className="text-left text-[10px] bg-slate-100 dark:bg-slate-800 p-3 rounded-xl overflow-x-auto text-slate-700 dark:text-slate-300 font-mono">
                <summary className="cursor-pointer font-bold mb-1">Error stack details</summary>
                {this.state.errorInfo.componentStack}
              </details>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
