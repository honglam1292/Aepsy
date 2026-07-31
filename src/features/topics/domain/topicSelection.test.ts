import { describe, expect, it } from "vitest";

import { areTopicSelectionsEqual } from "./topicSelection";

describe("areTopicSelectionsEqual", () => {
  it("matches selections only when their ordered values are identical", () => {
    expect(areTopicSelectionsEqual([], [])).toBe(true);
    expect(
      areTopicSelectionsEqual(
        ["U_DIS_STRESS", "U_DIS_SLEEP_PROBLEM"],
        ["U_DIS_STRESS", "U_DIS_SLEEP_PROBLEM"],
      ),
    ).toBe(true);
    expect(
      areTopicSelectionsEqual(
        ["U_DIS_STRESS", "U_DIS_SLEEP_PROBLEM"],
        ["U_DIS_SLEEP_PROBLEM", "U_DIS_STRESS"],
      ),
    ).toBe(false);
    expect(
      areTopicSelectionsEqual(
        ["U_DIS_STRESS"],
        ["U_DIS_STRESS", "U_DIS_SLEEP_PROBLEM"],
      ),
    ).toBe(false);
  });
});
