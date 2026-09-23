import { describe, expect, it } from "vitest";

import { resolveApiBaseUrl } from "./apiConfig";

describe("resolveApiBaseUrl", () => {
  it("uses the Metro proxy over HTTP on a private LAN", () => {
    expect(
      resolveApiBaseUrl({ isDev: true, metroHostUri: "192.168.1.7:8081" }),
    ).toBe("http://192.168.1.7:8081/api");
  });

  it("uses HTTPS for an Expo tunnel host", () => {
    expect(
      resolveApiBaseUrl({ isDev: true, metroHostUri: "preview.exp.direct" }),
    ).toBe("https://preview.exp.direct/api");
  });

  it("requires an HTTPS cloud API in release builds", () => {
    expect(
      resolveApiBaseUrl({
        isDev: false,
        configuredUrl: "https://doi-mat-ai-api.onrender.com/",
      }),
    ).toBe("https://doi-mat-ai-api.onrender.com");
    expect(
      resolveApiBaseUrl({
        isDev: false,
        configuredUrl: "http://server.example.com",
      }),
    ).toBeNull();
  });

  it("fails closed when a release API URL is missing", () => {
    expect(resolveApiBaseUrl({ isDev: false })).toBeNull();
  });
});
