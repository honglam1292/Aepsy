import type { TopicSuggestion } from "../../intake/domain/intakeTypes";

export interface SuppliedTopicOption {
  readonly value: string;
  readonly label: string;
}

export function normalizeTopicSuggestions(
  topicOptions: readonly unknown[],
): readonly TopicSuggestion[] {
  const seenTopicValues = new Set<string>();
  const suggestions: TopicSuggestion[] = [];

  for (const topicOption of topicOptions) {
    if (
      typeof topicOption !== "object" ||
      topicOption === null ||
      !("value" in topicOption) ||
      !("label" in topicOption) ||
      typeof topicOption.value !== "string" ||
      typeof topicOption.label !== "string" ||
      topicOption.value.trim().length === 0 ||
      topicOption.label.trim().length === 0
    ) {
      continue;
    }

    if (seenTopicValues.has(topicOption.value)) {
      continue;
    }

    seenTopicValues.add(topicOption.value);
    suggestions.push({
      topicValue: topicOption.value,
      label: topicOption.label,
    });
  }

  return suggestions;
}
