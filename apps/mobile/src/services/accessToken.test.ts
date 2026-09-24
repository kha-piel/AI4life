import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAccessToken, getAccessToken } from "./accessToken";

const secureStore = vi.hoisted(() => ({
  deleteItemAsync: vi.fn<(key: string) => Promise<void>>(),
  getItemAsync: vi.fn<(key: string) => Promise<string | null>>(),
  setItemAsync: vi.fn<(key: string, value: string) => Promise<void>>(),
}));

vi.mock("expo-secure-store", () => secureStore);

describe("AIVision access-token migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    secureStore.deleteItemAsync.mockResolvedValue();
    secureStore.setItemAsync.mockResolvedValue();
  });

  it("prefers the current AIVision key", async () => {
    secureStore.getItemAsync.mockResolvedValueOnce("current-token");

    await expect(getAccessToken()).resolves.toBe("current-token");
    expect(secureStore.getItemAsync).toHaveBeenCalledTimes(1);
  });

  it("migrates the legacy key without losing the invitation code", async () => {
    secureStore.getItemAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("legacy-token");

    await expect(getAccessToken()).resolves.toBe("legacy-token");
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      "aivision_access_token",
      "legacy-token",
    );
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(
      "doi_mat_ai_access_token",
    );
  });

  it("clears both current and legacy keys", async () => {
    await clearAccessToken();

    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(
      "aivision_access_token",
    );
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(
      "doi_mat_ai_access_token",
    );
  });
});
