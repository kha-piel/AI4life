import type {
  ApiResponse,
  LabelAnalysis,
  SceneAnalysis,
} from "../domain/types";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8000";

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function postImage<T>(
  endpoint: string,
  uri: string,
  fields: Record<string, string> = {},
): Promise<T> {
  const body = new FormData();
  body.append(
    "image",
    {
      uri,
      name: "capture.jpg",
      type: "image/jpeg",
    } as unknown as Blob,
  );
  for (const [key, value] of Object.entries(fields)) {
    body.append(key, value);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      body,
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new ApiClientError(
      "Không kết nối được máy chủ. Hãy kiểm tra mạng và địa chỉ API.",
      "network_error",
    );
  }

  let payload: ApiResponse<T>;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError(
      "Máy chủ trả dữ liệu không hợp lệ.",
      "invalid_response",
    );
  }

  if (!response.ok || !payload.success) {
    const error = payload.success ? null : payload.error;
    throw new ApiClientError(
      error?.message ?? "Không thể phân tích ảnh lúc này.",
      error?.code ?? "request_failed",
      error?.request_id,
    );
  }
  return payload.data;
}

export function analyzeLabel(uri: string, ocrText?: string): Promise<LabelAnalysis> {
  return postImage("/v1/analyze-label", uri, {
    locale: "vi-VN",
    ...(ocrText ? { ocr_text: ocrText } : {}),
  });
}

export function analyzeScene(uri: string): Promise<SceneAnalysis> {
  return postImage("/v1/analyze-scene", uri, { locale: "vi-VN" });
}

