import type { ReactElement } from "react";
import { Link, Outlet } from "react-router";

import {
  PersistenceStatus,
  StartOverControl,
} from "../../features/intake/presentation/IntakeProgressActions";
import { ProgressIndicator } from "./ProgressIndicator";

export function AppShell(): ReactElement {
  return (
    <div className="min-h-svh bg-primary-100 text-grey-600">
      <a
        className="absolute left-4 top-4 z-50 -translate-y-24 rounded-full bg-primary-600 px-5 py-3 font-semibold text-white outline-offset-4 transition-transform focus:translate-y-0 focus-visible:outline-2 focus-visible:outline-focus"
        href="#main-content"
      >
        Skip to main content
      </a>

      <header className="border-b border-primary-200 bg-white/90">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link
            aria-label="Aepsy intake home"
            className="rounded-sm font-serif text-2xl font-semibold text-primary-600 outline-offset-4 focus-visible:outline-2 focus-visible:outline-focus"
            to="/record"
          >
            aepsy
          </Link>
          <div className="flex items-center gap-3">
            <p className="hidden text-right text-sm leading-5 text-primary-500 md:block">
              Find support that feels right for you
            </p>
            <StartOverControl />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-5 py-7 sm:px-8 sm:py-10">
        <ProgressIndicator />
        <PersistenceStatus />
        <main
          className="mt-7 min-h-80 rounded-3xl bg-white p-6 shadow-sm sm:mt-9 sm:p-10 lg:p-12"
          id="main-content"
          tabIndex={-1}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
