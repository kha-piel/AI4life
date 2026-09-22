export type Confidence = "low" | "medium" | "high";

export type LabelAnalysis = {
  request_id: string;
  product_type: string | null;
  product_name: string | null;
  expiry_date: string | null;
  visible_instructions: string[];
  warnings: string[];
  unreadable_fields: string[];
  evidence_text: string[];
  confidence: Confidence;
  speech_text: string;
  provider: string;
  demo_mode: boolean;
};

export type SceneHazard = {
  type: "obstacle" | "person" | "stairs" | "wet_floor" | "blocked_path";
  direction: "left" | "center" | "right" | "unknown";
  urgency: "info" | "warning" | "urgent";
  confidence: Confidence;
  speech_text: string;
};

export type SceneAnalysis = {
  request_id: string;
  hazards: SceneHazard[];
  limitations: string[];
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

export type CaptureMode = "label" | "scene";

