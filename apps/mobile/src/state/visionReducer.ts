import type { LabelAnalysis } from "../domain/types";

export type VisionPhase =
  | "idle"
  | "guiding"
  | "capturing"
  | "analyzing"
  | "success"
  | "low_confidence"
  | "error";

export type VisionState = {
  phase: VisionPhase;
  result: LabelAnalysis | null;
  error: string | null;
};

export type VisionAction =
  | { type: "GUIDE" }
  | { type: "CAPTURE" }
  | { type: "ANALYZE" }
  | { type: "SUCCESS"; result: LabelAnalysis; lowConfidence: boolean }
  | { type: "ERROR"; message: string }
  | { type: "RESET" };

export const initialVisionState: VisionState = {
  phase: "idle",
  result: null,
  error: null,
};

export function visionReducer(
  state: VisionState,
  action: VisionAction,
): VisionState {
  switch (action.type) {
    case "GUIDE":
      return { phase: "guiding", result: null, error: null };
    case "CAPTURE":
      return { ...state, phase: "capturing", error: null };
    case "ANALYZE":
      return { ...state, phase: "analyzing", error: null };
    case "SUCCESS":
      return {
        phase: action.lowConfidence ? "low_confidence" : "success",
        result: action.result,
        error: null,
      };
    case "ERROR":
      return { ...state, phase: "error", error: action.message };
    case "RESET":
      return initialVisionState;
  }
}
