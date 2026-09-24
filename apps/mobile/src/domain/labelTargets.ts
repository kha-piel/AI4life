import type { LabelTarget } from "./types";

export type LabelTargetOption = {
  value: LabelTarget;
  label: string;
  hint: string;
  cameraGuide: string;
};

export const LABEL_TARGET_OPTIONS: readonly LabelTargetOption[] = [
  {
    value: "expiry_date",
    label: "Hạn sử dụng",
    hint: "Chỉ tìm và đọc ngày hết hạn trên nhãn",
    cameraGuide: "Đưa phần có chữ HSD, EXP hoặc Use by vào giữa khung hình.",
  },
  {
    value: "product_name",
    label: "Tên sản phẩm",
    hint: "Chỉ tìm và đọc tên sản phẩm",
    cameraGuide: "Đưa tên và mặt trước sản phẩm vào giữa khung hình.",
  },
  {
    value: "ingredients",
    label: "Thành phần",
    hint: "Chỉ tìm và đọc danh sách thành phần",
    cameraGuide: "Đưa mục Thành phần hoặc Ingredients vào giữa khung hình.",
  },
  {
    value: "usage_instructions",
    label: "Hướng dẫn sử dụng",
    hint: "Chỉ đọc hướng dẫn nhìn thấy trên nhãn",
    cameraGuide: "Đưa mục Hướng dẫn sử dụng vào giữa khung hình.",
  },
  {
    value: "all",
    label: "Đọc tất cả",
    hint: "Đọc các thông tin chính nhìn thấy trên nhãn",
    cameraGuide: "Đưa toàn bộ nhãn vào giữa khung hình và giữ điện thoại ổn định.",
  },
] as const;

export function getLabelTargetOption(target: LabelTarget): LabelTargetOption {
  return LABEL_TARGET_OPTIONS.find((option) => option.value === target)!;
}
