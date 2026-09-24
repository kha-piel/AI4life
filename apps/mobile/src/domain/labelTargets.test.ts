import { describe, expect, it } from "vitest";

import { getLabelTargetOption, LABEL_TARGET_OPTIONS } from "./labelTargets";

describe("label targets", () => {
  it("offers each focused reading mode exactly once", () => {
    expect(LABEL_TARGET_OPTIONS.map((option) => option.value)).toEqual([
      "expiry_date",
      "product_name",
      "ingredients",
      "usage_instructions",
      "all",
    ]);
  });

  it("provides camera guidance for the selected field", () => {
    expect(getLabelTargetOption("expiry_date").cameraGuide).toContain("HSD");
  });
});
