import Constants from "expo-constants";
import { fetch as expoFetch } from "expo/fetch";
import { File } from "expo-file-system";

import type {
  ApiResponse,
  LabelAnalysis,
  SceneAnalysis,
} from "../domain/types";
import { getAccessToken } from "./accessToken";
import { resolveApiBaseUrl } from "./apiConfig";

const API_BASE_URL = resolveApiBaseUrl({
  isDev: __DEV__,
  metroHostUri: Constants.expoConfig?.hostUri,
  configuredUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
});

export const APP_AUTH_REQUIRED =
  process.env.EXPO_PUBLIC_REQUIRE_APP_AUTH === "true";

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
  if (!API_BASE_URL) {
    throw new ApiClientError(
      "Bản cài đặt chưa được cấu hình máy chủ HTTPS.",
      "api_not_configured",
    );
  }

  const accessToken = APP_AUTH_REQUIRED ? await getAccessToken() : null;
  if (APP_AUTH_REQUIRED && !accessToken) {
    throw new ApiClientError(
      "Ứng dụng cần mã truy cập trước khi gửi ảnh.",
      "access_required",
    );
  }

  const body = new FormData();
  const image = new File(uri);
  body.append("image", image, "capture.jpg");
  for (const [key, value] of Object.entries(fields)) {
    body.append(key, value);
  }

  let response: Awaited<ReturnType<typeof expoFetch>>;
  try {
    response = await expoFetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      body,
      headers: {
        Accept: "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });
  } catch (error) {
    console.error("API request failed before receiving a response", {
      endpoint,
      apiBaseUrl: API_BASE_URL,
      imageUriScheme: uri.split(":", 1)[0] || "unknown",
      cause: error instanceof Error ? error.message : String(error),
    });
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

export async function validateAccessCode(accessCode: string): Promise<void> {
  if (!API_BASE_URL) {
    throw new ApiClientError(
      "Bản cài đặt chưa được cấu hình máy chủ HTTPS.",
      "api_not_configured",
    );
  }

  let response: Awaited<ReturnType<typeof expoFetch>>;
  try {
    response = await expoFetch(`${API_BASE_URL}/v1/access-check`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessCode.trim()}`,
      },
    });
  } catch {
    throw new ApiClientError(
      "Không kết nối được máy chủ để kiểm tra mã truy cập.",
      "network_error",
    );
  }

  if (!response.ok) {
    let message = "Mã truy cập không hợp lệ hoặc đã bị thu hồi.";
    try {
      const payload = (await response.json()) as ApiResponse<unknown>;
      if (!payload.success) message = payload.error.message;
    } catch {
      // Keep the safe generic message when a gateway returns non-JSON content.
    }
    throw new ApiClientError(message, "access_denied");
  }
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
