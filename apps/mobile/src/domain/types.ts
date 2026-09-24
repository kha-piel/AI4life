export type Confidence = "low" | "medium" | "high";

export type LabelTarget =
  | "expiry_date"
  | "product_name"
  | "ingredients"
  | "usage_instructions"
  | "all";

export type LabelAnalysis = {
  request_id: string;
  requested_field: LabelTarget;
  product_type: string | null;
  product_name: string | null;
  expiry_date: string | null;
  ingredients: string[];
  visible_instructions: string[];
  warnings: string[];
  unreadable_fields: string[];
  evidence_text: string[];
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
