import type { ReactElement } from "react";

export function TopicsPage(): ReactElement {
  return (
    <section aria-labelledby="topics-title">
      <title>Aepsy | Review your topics</title>
      <p className="text-sm font-semibold uppercase tracking-widest text-primary-500">
        Step 2 of 3
      </p>
      <h1
        className="mt-3 max-w-3xl font-serif text-4xl leading-tight text-primary-600 sm:text-5xl"
        id="topics-title"
      >
        Review your topics
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-grey-500">
        Suggested topics and selection controls will appear here after a voice
        note has been processed.
      </p>
    </section>
  );
}
