import type { ReactElement } from "react";

export function MatchesPage(): ReactElement {
  return (
    <section aria-labelledby="matches-title">
      <title>Aepsy | Meet your matches</title>
      <p className="text-sm font-semibold uppercase tracking-widest text-primary-500">
        Step 3 of 3
      </p>
      <h1
        className="mt-3 max-w-3xl font-serif text-4xl leading-tight text-primary-600 sm:text-5xl"
        id="matches-title"
      >
        Meet your matches
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-grey-500">
        Recommended psychologists will appear here after you choose at least
        one topic.
      </p>
    </section>
  );
}
