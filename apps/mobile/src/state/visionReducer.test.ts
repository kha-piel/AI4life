import { describe, expect, it } from "vitest";

import type { LabelAnalysis } from "../domain/types";
import { initialVisionState, visionReducer } from "./visionReducer";

const result: LabelAnalysis = {
  request_id: "req-1",
  requested_field: "product_name",
  image_count: 2,
  product_type: "food",
  product_name: "Nước mắm",
  expiry_date: null,
  ingredients: [],
  visible_instructions: [],
  warnings: [],
  unreadable_fields: ["hạn sử dụng"],
  evidence_text: ["NƯỚC MẮM"],
  nutrition_facts: {
    serving_size: null,
    total_carbohydrate_g: null,
    total_sugars_g: null,
    added_sugars_g: null,
    dietary_fiber_g: null,
    sodium_mg: null,
  },
  health_assessment: null,
  confidence: "low",
  speech_text: "Có thể là nước mắm.",
  provider: "fixture",
  demo_mode: true,
};

describe("visionReducer", () => {
  it("exposes low confidence as a distinct state", () => {
    const state = visionReducer(initialVisionState, {
      type: "SUCCESS",
      result,
      lowConfidence: true,
    });

    expect(state.phase).toBe("low_confidence");
    expect(state.result).toBe(result);
  });

  it("clears stale results on reset", () => {
    const success = visionReducer(initialVisionState, {
      type: "SUCCESS",
      result,
      lowConfidence: false,
    });

    expect(visionReducer(success, { type: "RESET" })).toEqual(initialVisionState);
  });
});
