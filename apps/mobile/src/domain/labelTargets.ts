import type { LabelTarget } from "./types";

export type LabelTargetOption = {
  value: LabelTarget;
  label: string;
  hint: string;
  cameraGuide: string;
};

export const LABEL_TARGET_OPTIONS: readonly LabelTargetOption[] = [
  {
    value: "all",
    label: "Đọc và phân tích nhãn",
    hint: "Đọc toàn bộ thông tin chính và phân tích theo hồ sơ đã chọn",
    cameraGuide: "Chụp rõ mặt trước, thành phần và bảng dinh dưỡng của cùng một sản phẩm.",
  },
] as const;

export function getLabelTargetOption(target: LabelTarget): LabelTargetOption {
  return LABEL_TARGET_OPTIONS.find((option) => option.value === target)!;
}
