import { Component, type ReactNode } from "react";
import { logError } from "@/lib/errorHandler";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: { componentStack: string }) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, componentStack: null };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Log to console
    console.error("[ErrorBoundary] Caught error:", error.message, info.componentStack);

    // Send to error tracking service (context is a string for logError)
    logError(error, `ErrorBoundary: ${error.message}`);

    // Call optional onError callback
    this.props.onError?.(error, info);

    this.setState({ componentStack: info.componentStack });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, componentStack: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const errorMessage = this.state.error?.message || "An unexpected error occurred";

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] dark:bg-[#121212] p-4">
          <div className="max-w-md w-full mx-auto text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-muted-foreground mb-2">
              We hit an unexpected error. Please try again.
            </p>
            {process.env.NODE_ENV === "development" && errorMessage && (
              <p className="text-xs text-destructive/70 mb-4 p-2 bg-destructive/5 rounded-lg font-mono break-all">
                {errorMessage}
              </p>
            )}
            <div className="flex items-center justify-center gap-3">
              <Button
                onClick={this.handleReset}
                variant="outline"
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
              <Button
                onClick={this.handleReload}
                className="gap-2"
              >
                <Home className="h-4 w-4" />
                Reload page
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}