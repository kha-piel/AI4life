import Constants from "expo-constants";
import { fetch as expoFetch } from "expo/fetch";
import { File } from "expo-file-system";

import type {
  ApiResponse,
  LabelAnalysis,
  LabelTarget,
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

const REQUEST_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 2;
const TRANSIENT_STATUS_CODES = new Set([502, 503, 504]);

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createImageBody(
  uri: string,
  fields: Record<string, string>,
): FormData {
  const body = new FormData();
  body.append("image", new File(uri), "capture.jpg");
  for (const [key, value] of Object.entries(fields)) {
    body.append(key, value);
  }
  return body;
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

  let response: Awaited<ReturnType<typeof expoFetch>> | null = null;
  let lastNetworkError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      response = await expoFetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        body: createImageBody(uri, fields),
        headers: {
          Accept: "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        signal: controller.signal,
      });
      if (
        attempt < MAX_ATTEMPTS &&
        TRANSIENT_STATUS_CODES.has(response.status)
      ) {
        await wait(1_500);
        continue;
      }
      break;
    } catch (error) {
      lastNetworkError = error;
      if (attempt < MAX_ATTEMPTS) {
        await wait(1_500);
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!response) {
    console.error("API request failed before receiving a response", {
      endpoint,
      apiBaseUrl: API_BASE_URL,
      imageUriScheme: uri.split(":", 1)[0] || "unknown",
      cause:
        lastNetworkError instanceof Error
          ? lastNetworkError.message
          : String(lastNetworkError),
    });
    throw new ApiClientError(
      "Máy chủ miễn phí đang khởi động hoặc mạng chưa ổn định. Hãy đợi một phút rồi thử lại.",
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

export function analyzeLabel(
  uri: string,
  requestedField: LabelTarget,
  ocrText?: string,
): Promise<LabelAnalysis> {
  return postImage("/v1/analyze-label", uri, {
    locale: "vi-VN",
    requested_field: requestedField,
    ...(ocrText ? { ocr_text: ocrText } : {}),
  });
}
