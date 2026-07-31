# Aepsy Intake

## Project Overview

This is the Aepsy AG React frontend take-home assignment. It implements a responsive web application that guides a user through a short mental-health intake flow: record a voice note, review suggested topics, and find psychologists who match the selected topics.

The implementation emphasises explicit workflow state, understandable interruption recovery, local progress persistence, defensive API mapping, and focused boundaries around browser and network APIs.

## User Flow

1. **Voice recording:** The user starts and stops a recording, reviews it with native browser audio controls, and can record again.
2. **Topic suggestions:** The completed audio is processed with the supplied mocked behaviour. Suggestions can be searched and selected with one or more checkboxes.
3. **Psychologist matching:** Selected topic value identifiers are sent to the supplied GraphQL search. Results appear as provider cards, with additional pages available through **Load more psychologists**.

## Technology Choices

- **Vite** for a small development and production build setup.
- **React** and **TypeScript** for the interface and strict workflow modelling.
- **React Router** for guarded routes, browser navigation, and route-level focus handling.
- **React Context** and **`useReducer`** for one predictable cross-step state-management path.
- **Apollo Client** for the supplied GraphQL API.
- **localStorage** for small, serialisable workflow metadata.
- **IndexedDB** for completed audio `Blob` data.
- **Tailwind CSS v4** and application-owned theme tokens for responsive styling.
- **Vitest**, **React Testing Library**, and **user-event** for focused domain and critical-flow tests in jsdom.

## Architecture

The source is organised by feature, with application composition under `src/app`:

```text
src/
├── app/                 Application composition, routing, and layout
├── features/
│   ├── intake/          Workflow state and persistence coordination
│   ├── recording/       Recording controller and browser/storage adapters
│   ├── topics/          Supplied processor adaptation and topic selection
│   └── providers/       Provider search state, GraphQL mapping, and UI
└── styles/              Application-owned theme and global styles
materials/               Unchanged source materials supplied for the assignment
```

- Pure domain transitions own workflow rules and downstream invalidation.
- Application hooks coordinate asynchronous work and dispatch domain events.
- Focused adapters isolate `MediaRecorder`, browser storage, object URLs, and Apollo execution.
- GraphQL DTOs are mapped to application-owned provider models before reaching presentation components.
- Pages render workflow state; smaller components own topic controls and provider cards.

The supplied helper, query, design image, and theme tokens remain unchanged under `materials/`. Application-owned adaptations live under `src/`.

## State Management

A React context backed by `useReducer` models cross-step workflow state. Focused persistence and recording contexts expose controllers without creating a parallel domain-state path. This keeps transitions explicit without adding a larger state library than the assignment needs.

- Recording uses explicit `idle`, `requestingPermission`, `recording`, `stopping`, `recorded`, `interrupted`, `unsupported`, and `error` states.
- Topic state covers unavailable, processing, empty, error, and processed outcomes, including suggestions and selected topic values.
- Hydration prevents route guards from deciding where to navigate until persisted progress has been resolved.
- Provider search distinguishes initial loading and error states from Load More loading and errors, so existing results remain visible if a later page fails.
- Recording, topic-processing, and provider request identifiers reject results from superseded asynchronous work.

## State Invalidation

- Re-recording clears topic suggestions and selected topics, then invalidates provider results and pagination.
- Changing selected topic values invalidates provider results and pagination.
- Navigating backward without editing preserves valid completed progress.
- Route guards send invalid direct navigation to the nearest valid step only after hydration finishes.

## Voice Recording

Microphone permission is explained before it is requested, and `getUserMedia` runs only after **Start recording** is selected. A focused browser adapter wraps `MediaRecorder`, `MediaStream`, and track lifecycle behaviour. It chooses from supported audio MIME types and falls back to the browser default instead of assuming `audio/webm` support.

The page shows elapsed time and supports stop, playback, pause, seeking, and re-recording through semantic buttons and native audio controls. Duplicate Stop actions share the active stop operation. Stream tracks and listeners are cleaned up after completion, failure, interruption, timeout, or component cleanup so the microphone is not intentionally left active.

Unsupported media APIs, denied permission, missing or unavailable microphones, interrupted tracks, empty output, and recorder errors produce calm recovery guidance rather than raw browser messages.

## Persistence and Refresh Recovery

Versioned, runtime-validated metadata is stored in localStorage. It includes the current valid step, completed-recording metadata, persisted topic suggestions and selections, and any unfinished recording attempt identifier. Completed audio is stored as a `Blob` in IndexedDB because binary audio does not belong in localStorage.

Object URLs are never persisted. Hydration loads the matching `Blob`, verifies it against the metadata, and creates a fresh object URL for playback. Completed audio is written before completed metadata is published to reduce partial-write risk.

A completed recording and its valid topic progress can be restored after refresh or reopening the page while browser storage remains available. An active recording cannot resume after refresh; it returns as interrupted with a **Record again** path. Missing audio becomes interrupted immediately. If browser storage cannot be read, the user can retry when appropriate or continue in memory; continuing without restorable audio also produces an interrupted state.

Provider responses are not persisted and are re-fetched from persisted selected topic values. **Start over** requests removal of localStorage metadata, IndexedDB audio, the active object URL, and in-memory workflow state, and reports if durable cleanup could not be completed.

## Topic Processing

An application-owned adaptation preserves the behaviour supplied in `materials/useAudioTranscriber.tsx`: it accepts `ArrayBuffer` or `Uint8Array` input, exposes loading, data, error, and `processAudio`, waits about two seconds, and returns the supplied mocked topic list. The completed `Blob` is read as an `ArrayBuffer` before processing.

This is simulated topic suggestion, not real transcription or diagnosis. Successful suggestions and selected topic values persist with the recording ID that produced them. Exact duplicate values are normalised by keeping the first occurrence; equal labels with different values remain distinct. Topic values, never display labels, are used as API identifiers.

## GraphQL and Pagination

Provider search uses an application-owned adaptation of `materials/queries.ts`. The supplied endpoint, `https://api-dev.aepsy.com/graphql`, is the default; `VITE_GRAPHQL_ENDPOINT` can override it for another environment. Selected topic values are passed through `rawDisorders`, while the supplied empty client-type, language, and provider-area filters and `INDIVIDUAL` chapter type are preserved.

The development API currently rejects page `0` and returns results from page `1`, so pagination starts at `1`. The page size is `6`. Load More permits one request at a time, prevents the same page from being appended twice, and preserves existing results after a later-page error.

Providers are deduplicated by `firebaseUid`. If it is missing, the mapper builds a best-effort identity from returned profile fields; wholly anonymous rows use a page-scoped fallback. Nullable rows and fields are cleaned and mapped before rendering. Provider responses are re-fetched rather than restored after refresh.

## Provider Card Decisions

`materials/provider-item.png` is used as visual direction for the card hierarchy, avatar, profile text, and supporting tags. Cards display only fields available from the supplied query: name, avatar, years of experience, provider title, and non-empty returned tag text.

Session counts and flexible offerings shown in the reference image are not fabricated. Ratings, availability, pricing, and credentials absent from the query are also omitted. Missing or broken avatars use initials when possible and a neutral fallback otherwise; missing profile fields retain a stable layout with restrained fallback copy.

## Product and UX Decisions

- The interface uses calm, direct, non-diagnostic language.
- The three-step progress indicator distinguishes current, available, and unavailable steps.
- Recording, processing, hydration, and provider search expose meaningful loading, empty, error, retry, and recovery states.
- Editing an earlier answer clears only dependent state; navigation alone does not discard valid work.
- An application error boundary provides a reload action for unexpected rendering failures.

## Privacy

Recorded audio is not uploaded by this implementation. Recording and mocked topic processing happen in the browser, and completed audio is stored locally in IndexedDB when available. Only selected topic identifiers are sent to the psychologist-search API.

Audio contents, selected mental-health topics, and provider personal data are not written to console logs. Browser-local storage is not described as encrypted and may be unavailable or cleared by the browser. **Start over** attempts to remove all locally persisted intake progress and reports incomplete cleanup.

## Deployment

GitHub Pages URL: [https://honglam1292.github.io/Aepsy/](https://honglam1292.github.io/Aepsy/)


## Getting Started

Use Node.js `^20.19.0` or `>=22.12.0`, then run:

```bash
npm install
npm run dev
```

## Available Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run lint` | Run ESLint. |
| `npm run test` | Run Vitest in watch mode. |
| `npm run test:run` | Run the automated test suite once. |
| `npm run build` | Run the TypeScript project build and create a production bundle. |
| `npm run validate` | Run lint, the automated test suite, and the production build. |

## Verification

The focused automated suite covers workflow invalidation, recording controls and recovery, persistence and route guards, topic processing and selection, provider pagination, and the critical cross-step flow. It tests observable behaviour with mocked browser, storage, and GraphQL boundaries; it does not claim exhaustive coverage or browser certification.

Native audio playback under a user gesture, real microphone and IndexedDB behaviour, the full browser failure matrix, screen-reader behaviour, and wider browser and device coverage remain manual checks.

## Trade-offs and Assumptions

- An in-progress recording cannot be resumed after refresh because browser media sessions are not serialisable.
- Browser recording requires `MediaRecorder` and media-device support. Durable recovery additionally depends on localStorage and IndexedDB; the flow can continue in memory when storage fails.
- Provider responses are re-fetched instead of persisted to avoid restoring stale API data.
- One-based GraphQL pagination reflects the current development API behaviour and is isolated behind a named starting-page constant.
- Real transcription, diagnosis, provider details outside the query, and non-essential audio visualisation are outside the assignment scope.

## Improvements with More Time

- Add browser-level end-to-end tests with media fixtures and IndexedDB reloads.
- Run a wider Safari, Firefox, Chromium, device, and assistive-technology verification matrix.
- Generate GraphQL DTO types from the schema and supplied operation.
- Add local-data expiry and explicit IndexedDB migrations.
- Add internationalisation before introducing translated content.
