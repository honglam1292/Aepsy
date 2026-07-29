import { Component } from "react";
import type { ReactNode } from "react";

interface AppErrorBoundaryProps {
  readonly children: ReactNode;
}

interface AppErrorBoundaryState {
  readonly hasError: boolean;
}

const initialState: AppErrorBoundaryState = { hasError: false };

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  public state: AppErrorBoundaryState = initialState;

  public static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  private readonly handleReload = (): void => {
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="grid min-h-svh place-items-center bg-primary-100 px-5 py-12">
          <section className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary-500">
              Something went wrong
            </p>
            <h1 className="mt-3 font-serif text-3xl text-primary-600">
              We could not show this page
            </h1>
            <p className="mt-4 text-base leading-7 text-grey-500">
              Reload the application to try again.
            </p>
            <button
              className="mt-7 min-h-11 rounded-full bg-primary-600 px-6 py-3 font-semibold text-white outline-offset-4 hover:bg-primary-500 focus-visible:outline-2 focus-visible:outline-focus"
              onClick={this.handleReload}
              type="button"
            >
              Reload application
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
