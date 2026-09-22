import { describe, expect, it } from "vitest";

import { filterNovelHazards } from "./hazardDedup";
import type { SceneHazard } from "./types";

const warning: SceneHazard = {
  type: "obstacle",
  direction: "center",
  urgency: "warning",
  confidence: "medium",
  speech_text: "Có vật cản ở phía trước.",
};

describe("filterNovelHazards", () => {
  it("suppresses repeated audio within the cooldown", () => {
    const first = filterNovelHazards([warning], {}, 1_000);
    const second = filterNovelHazards([warning], first.nextMemory, 2_000);

    expect(first.novel).toHaveLength(1);
    expect(second.novel).toHaveLength(0);
  });

  it("announces immediately when urgency increases", () => {
    const first = filterNovelHazards([warning], {}, 1_000);
    const urgent = { ...warning, urgency: "urgent" as const };
    const second = filterNovelHazards([urgent], first.nextMemory, 2_000);

    expect(second.novel).toEqual([urgent]);
  });
});

