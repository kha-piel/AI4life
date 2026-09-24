export type Confidence = "low" | "medium" | "high";

export type LabelTarget =
  | "expiry_date"
  | "product_name"
  | "ingredients"
  | "usage_instructions"
  | "all";

export type HealthCondition = "diabetes";
export type HealthVerdict = "consider" | "limit" | "avoid" | "uncertain";

export type NutritionFacts = {
  serving_size: string | null;
  total_carbohydrate_g: number | null;
  total_sugars_g: number | null;
  added_sugars_g: number | null;
  dietary_fiber_g: number | null;
  sodium_mg: number | null;
};

export type HealthAssessment = {
  condition: HealthCondition;
  verdict: HealthVerdict;
  summary: string;
  reasons: string[];
  ingredient_assessments: {
    ingredient: string;
    verdict: HealthVerdict;
    reason: string;
  }[];
  missing_information: string[];
};

export type LabelAnalysis = {
  request_id: string;
  requested_field: LabelTarget;
  image_count: number;
  product_type: string | null;
  product_name: string | null;
  expiry_date: string | null;
  ingredients: string[];
  visible_instructions: string[];
  warnings: string[];
  unreadable_fields: string[];
  evidence_text: string[];
  nutrition_facts: NutritionFacts;
  health_assessment: HealthAssessment | null;
  confidence: Confidence;
  speech_text: string;
  provider: string;
  demo_mode: boolean;
};

export type ApiErrorDetail = {
  code: string;
  message: string;
  request_id: string;
};

export type ApiResponse<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: ApiErrorDetail };
