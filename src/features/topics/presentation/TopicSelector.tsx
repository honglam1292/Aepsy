import { useRef, useState, type ReactElement } from "react";

import type { TopicSuggestion } from "../../intake/domain/intakeTypes";

interface TopicSelectorProps {
  readonly suggestions: readonly TopicSuggestion[];
  readonly selectedTopicValues: readonly string[];
  setTopicSelected(topicValue: string, isSelected: boolean): void;
}

export function TopicSelector({
  suggestions,
  selectedTopicValues,
  setTopicSelected,
}: TopicSelectorProps): ReactElement {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const visibleSuggestions =
    normalizedQuery.length === 0
      ? suggestions
      : suggestions.filter((suggestion) =>
          suggestion.label.toLocaleLowerCase().includes(normalizedQuery),
        );
  const labelCounts = new Map<string, number>();
  const labelPositions = new Map<string, number>();
  for (const suggestion of suggestions) {
    const position = (labelCounts.get(suggestion.label) ?? 0) + 1;
    labelCounts.set(suggestion.label, position);
    labelPositions.set(suggestion.topicValue, position);
  }
  const selectedTopics = new Set(selectedTopicValues);

  const clearSearch = (): void => {
    setSearchQuery("");
    globalThis.setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  return (
    <div className="mt-8">
      <div className="max-w-xl">
        <label
          className="block font-semibold text-primary-600"
          htmlFor="topic-search"
        >
          Search suggested topics
        </label>
        <p className="mt-1 text-sm leading-6 text-grey-500" id="topic-search-help">
          Filter the list by words such as stress, sleep, or relationships.
        </p>
        <input
          aria-describedby="topic-search-help"
          className="mt-3 w-full rounded-xl border border-primary-300 bg-white px-4 py-3 text-grey-600 outline-offset-2 placeholder:text-grey-400 focus-visible:outline-2 focus-visible:outline-focus"
          id="topic-search"
          onChange={(event) => setSearchQuery(event.currentTarget.value)}
          placeholder="Search topics"
          ref={searchInputRef}
          type="search"
          value={searchQuery}
        />
      </div>

      <div
        aria-atomic="true"
        aria-live="polite"
        className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-grey-500"
      >
        <p>
          Showing {visibleSuggestions.length} of {suggestions.length} topics
        </p>
        <p>
          {selectedTopicValues.length} {selectedTopicValues.length === 1 ? "topic" : "topics"} selected
        </p>
      </div>

      {visibleSuggestions.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-primary-200 bg-primary-100 p-5">
          <p className="font-semibold text-primary-600">
            No topics match that search.
          </p>
          <button
            className="mt-4 rounded-full border border-primary-400 bg-white px-5 py-2.5 font-semibold text-primary-600 outline-offset-4 hover:bg-primary-200 focus-visible:outline-2 focus-visible:outline-focus"
            onClick={clearSearch}
            type="button"
          >
            Clear search
          </button>
        </div>
      ) : (
        <fieldset className="mt-6">
          <legend className="font-serif text-2xl text-primary-600">
            Select the topics you want support with
          </legend>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {visibleSuggestions.map((suggestion) => {
              const isSelected = selectedTopics.has(suggestion.topicValue);
              const inputId = `topic-${encodeURIComponent(suggestion.topicValue)}`;
              const matchingLabelCount = labelCounts.get(suggestion.label) ?? 1;
              const matchingLabelPosition =
                labelPositions.get(suggestion.topicValue) ?? 1;
              const accessibleLabel =
                matchingLabelCount > 1
                  ? `${suggestion.label}, suggestion ${matchingLabelPosition} of ${matchingLabelCount}`
                  : suggestion.label;

              return (
                <li key={suggestion.topicValue}>
                  <label
                    className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 outline-offset-4 transition-colors focus-within:outline-2 focus-within:outline-focus ${
                      isSelected
                        ? "border-primary-600 bg-primary-200"
                        : "border-primary-300 bg-white hover:bg-primary-100"
                    }`}
                    htmlFor={inputId}
                  >
                    <input
                      aria-label={accessibleLabel}
                      checked={isSelected}
                      className="size-5 shrink-0 accent-primary-600"
                      id={inputId}
                      name="selected-topics"
                      onChange={(event) =>
                        setTopicSelected(
                          suggestion.topicValue,
                          event.currentTarget.checked,
                        )
                      }
                      type="checkbox"
                      value={suggestion.topicValue}
                    />
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                      <span className="font-semibold leading-6 text-primary-600">
                        {suggestion.label}
                        {matchingLabelCount > 1 ? (
                          <span className="mt-0.5 block text-xs font-medium text-grey-500">
                            Suggestion {matchingLabelPosition} of {matchingLabelCount}
                          </span>
                        ) : null}
                      </span>
                      {isSelected ? (
                        <span
                          aria-hidden="true"
                          className="shrink-0 text-xs font-bold uppercase tracking-wide text-primary-600"
                        >
                          ✓ Selected
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}
    </div>
  );
}
