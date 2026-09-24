import type { HealthCondition, LabelTarget } from "./types";

export const DEFAULT_SCAN_PROFILE: Readonly<{
  requestedField: LabelTarget;
  healthCondition: HealthCondition;
}> = {
  requestedField: "all",
  healthCondition: "diabetes",
};
