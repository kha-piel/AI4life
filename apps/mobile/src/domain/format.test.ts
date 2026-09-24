import { describe, expect, it } from "vitest";

import { expiryToVietnamese } from "./format";

describe("expiryToVietnamese", () => {
  it("formats a valid API date", () => {
    expect(expiryToVietnamese("2027-10")).toBe("tháng 10 năm 2027");
    expect(expiryToVietnamese("2027-10-15")).toBe(
      "ngày 15 tháng 10 năm 2027",
    );
  });

  it("refuses invalid months instead of guessing", () => {
    expect(expiryToVietnamese("2027-13")).toBeNull();
    expect(expiryToVietnamese("10/2027")).toBeNull();
    expect(expiryToVietnamese("2027-02-30")).toBeNull();
  });
});
