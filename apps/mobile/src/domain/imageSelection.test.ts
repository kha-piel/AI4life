import { describe, expect, it } from "vitest";

import { MAX_LABEL_IMAGES, mergeImageUris } from "./imageSelection";

describe("image selection", () => {
  it("keeps camera and library images in order", () => {
    expect(mergeImageUris(["camera-1"], ["library-1", "library-2"])).toEqual([
      "camera-1",
      "library-1",
      "library-2",
    ]);
  });

  it("deduplicates images and enforces the provider limit", () => {
    expect(
      mergeImageUris(["one", "two"], ["two", "three", "four"]),
    ).toEqual(["one", "two", "three"]);
    expect(MAX_LABEL_IMAGES).toBe(3);
  });
});
