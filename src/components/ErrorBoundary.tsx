import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] dark:bg-[#121212]">
          <div className="max-w-md w-full mx-auto p-6 text-center">
            <h1 className="text-2xl font-black text-[#111111] dark:text-[#FAF5F2] mb-2">Something went wrong</h1>
            <p className="text-sm text-[#888880] dark:text-[#A0A0A0] mb-4">
              We hit an unexpected error. Please refresh the page.
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-6 py-2 bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] rounded-full text-sm font-semibold"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}