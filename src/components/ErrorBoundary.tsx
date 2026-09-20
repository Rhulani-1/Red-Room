import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { reportError } from "@/lib/monitoring";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("Unhandled application error:", error, info);
    // Previously this crash was only ever visible in the user's own console.
    reportError(error, { componentStack: info });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-dvh flex items-center justify-center bg-background p-4">
        <Card className="max-w-xl w-full border border-border p-8 shadow-xl">
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-sm text-muted-foreground mb-6">
            An unexpected error occurred while loading the app. Refresh to try again.
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={() => window.location.reload()}>Reload page</Button>
          </div>
          <div className="mt-6 text-xs text-muted-foreground">
            {this.state.error?.message}
          </div>
        </Card>
      </div>
    );
  }
}
