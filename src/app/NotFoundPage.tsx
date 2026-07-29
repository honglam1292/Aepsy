import type { ReactElement } from "react";
import { Link } from "react-router";

export function NotFoundPage(): ReactElement {
  return (
    <section aria-labelledby="not-found-title">
      <title>Aepsy | Page not found</title>
      <p className="text-sm font-semibold uppercase tracking-widest text-primary-500">
        404
      </p>
      <h1
        className="mt-3 font-serif text-4xl leading-tight text-primary-600 sm:text-5xl"
        id="not-found-title"
      >
        Page not found
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-grey-500">
        The page you requested is not part of this intake flow.
      </p>
      <Link
        className="mt-8 inline-flex min-h-11 items-center rounded-full bg-primary-600 px-6 py-3 font-semibold text-white outline-offset-4 hover:bg-primary-500 focus-visible:outline-2 focus-visible:outline-focus"
        to="/record"
      >
        Return to recording
      </Link>
    </section>
  );
}
