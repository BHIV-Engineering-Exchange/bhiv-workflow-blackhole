import React from 'react';
import { AlertTriangle } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("[ERROR BOUNDARY CATCH]", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center w-full">
                    <AlertTriangle className="h-12 w-12 text-rose-500 mb-4" />
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">System Interruption Isolated</h2>
                    <p className="text-slate-600 dark:text-slate-400 max-w-md">
                        A component failed to render gracefully. The issue has been contained securely by the frontend error boundary.
                    </p>
                    <details className="mt-4 text-left bg-slate-100 dark:bg-slate-900/50 p-4 rounded-lg w-full max-w-2xl overflow-auto text-[10px] font-mono border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                        <summary className="cursor-pointer font-bold mb-2">View Telemetry / Stack Output</summary>
                        {this.state.error && this.state.error.toString()}
                        <br />
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </details>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors font-semibold text-sm"
                    >
                        Re-Initialize Application State
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
