import { describe, expect, it } from "vitest";

import { DEFAULT_SCAN_PROFILE } from "./scanProfile";

describe("default scan profile", () => {
  it("always combines complete label reading with diabetes screening", () => {
    expect(DEFAULT_SCAN_PROFILE).toEqual({
      requestedField: "all",
      healthCondition: "diabetes",
    });
  });
});
