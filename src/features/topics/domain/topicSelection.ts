export function areTopicSelectionsEqual(
  firstSelection: readonly string[],
  secondSelection: readonly string[],
): boolean {
  return (
    firstSelection.length === secondSelection.length &&
    firstSelection.every(
      (topicValue, index) => topicValue === secondSelection[index],
    )
  );
}
