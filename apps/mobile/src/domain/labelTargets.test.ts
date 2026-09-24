import { describe, expect, it } from "vitest";

import { getLabelTargetOption, LABEL_TARGET_OPTIONS } from "./labelTargets";

describe("label targets", () => {
  it("offers only the complete label journey", () => {
    expect(LABEL_TARGET_OPTIONS.map((option) => option.value)).toEqual(["all"]);
  });

  it("provides guidance for all required label sides", () => {
    expect(getLabelTargetOption("all").cameraGuide).toContain("bảng dinh dưỡng");
  });
});
