import type { ReactElement } from "react";

export function RecordPage(): ReactElement {
  return (
    <section aria-labelledby="record-title">
      <title>Aepsy | Record your voice note</title>
      <p className="text-sm font-semibold uppercase tracking-widest text-primary-500">
        Step 1 of 3
      </p>
      <h1
        className="mt-3 max-w-3xl font-serif text-4xl leading-tight text-primary-600 sm:text-5xl"
        id="record-title"
      >
        Tell us what’s on your mind
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-grey-500">
        You’ll be able to record a short voice note here and listen to it before
        continuing.
      </p>
      <aside className="mt-9 rounded-2xl border border-primary-300 bg-primary-100 p-5 sm:p-6">
        <h2 className="font-serif text-xl text-primary-600">What to expect</h2>
        <p className="mt-2 max-w-2xl leading-7 text-grey-500">
          Recording controls and interruption recovery will be introduced in
          the dedicated recording step of the implementation.
        </p>
      </aside>
    </section>
  );
}
