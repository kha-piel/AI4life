import { StyleSheet, Text, View } from "react-native";

import { expiryToVietnamese } from "../domain/format";
import { getLabelTargetOption } from "../domain/labelTargets";
import type { LabelAnalysis } from "../domain/types";
import { ActionButton } from "./ActionButton";

const HEALTH_VERDICT_LABELS = {
  consider: "Có thể cân nhắc",
  limit: "Nên hạn chế",
  avoid: "Nên tránh",
  uncertain: "Chưa đủ dữ liệu",
} as const;

type Props = {
  result: LabelAnalysis;
  onReadAgain: () => void;
  onRetry: () => void;
};

export function ResultCard({ result, onReadAgain, onRetry }: Props) {
  const target = getLabelTargetOption(result.requested_field);
  const formattedExpiry = expiryToVietnamese(result.expiry_date);

  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      {result.demo_mode ? (
        <Text style={styles.demoBadge}>CHẾ ĐỘ DỮ LIỆU MẪU</Text>
      ) : null}
      <Text style={styles.title} accessibilityRole="header">
        {target.label}
      </Text>

      <Text style={styles.body}>{result.speech_text}</Text>
      <Text style={styles.note}>Đã phân tích {result.image_count} ảnh.</Text>

      {result.requested_field === "all" ? (
        <>
          {result.product_name ? (
            <Text style={styles.detail}>Tên: {result.product_name}</Text>
          ) : null}
          {formattedExpiry ? (
            <Text style={styles.detail}>Hạn sử dụng: {formattedExpiry}</Text>
          ) : null}
          {result.ingredients.length > 0 ? (
            <Text style={styles.detail}>
              Thành phần: {result.ingredients.join(", ")}
            </Text>
          ) : null}
          {result.visible_instructions.length > 0 ? (
            <Text style={styles.detail}>
              Hướng dẫn: {result.visible_instructions.join("; ")}
            </Text>
          ) : null}
        </>
      ) : null}

      {result.health_assessment ? (
        <View style={styles.healthCard}>
          <Text style={styles.healthTitle}>Phân tích cho người tiểu đường</Text>
          <Text style={styles.verdict} accessibilityRole="header">
            {HEALTH_VERDICT_LABELS[result.health_assessment.verdict]}
          </Text>
          <Text style={styles.detail}>{result.health_assessment.summary}</Text>
          {result.health_assessment.reasons.map((reason, index) => (
            <Text key={`${reason}-${index}`} style={styles.healthReason}>
              • {reason}
            </Text>
          ))}
          {result.health_assessment.ingredient_assessments.length > 0 ? (
            <Text style={styles.healthSubtitle}>Đánh giá thành phần</Text>
          ) : null}
          {result.health_assessment.ingredient_assessments.map((item, index) => (
            <Text key={`${item.ingredient}-${index}`} style={styles.healthReason}>
              • {item.ingredient} — {HEALTH_VERDICT_LABELS[item.verdict]}: {item.reason}
            </Text>
          ))}
          {result.health_assessment.missing_information.length > 0 ? (
            <Text style={styles.warning}>
              Cần đọc thêm: {result.health_assessment.missing_information.join(", ")}
            </Text>
          ) : null}
          <Text style={styles.medicalNote}>
            Đây là sàng lọc từ nhãn, không thay thế tư vấn của bác sĩ hoặc chuyên gia dinh dưỡng.
          </Text>
        </View>
      ) : null}

      {result.evidence_text.length > 0 ? (
        <Text style={styles.note}>
          Chữ nhìn thấy: {result.evidence_text.slice(0, 4).join(" · ")}
        </Text>
      ) : null}
      {result.unreadable_fields.length > 0 ? (
        <Text style={styles.warning}>
          Chưa đọc rõ: {result.unreadable_fields.join(", ")}
        </Text>
      ) : null}
      {result.warnings.map((warning) => (
        <Text key={warning} style={styles.warning}>
          {warning}
        </Text>
      ))}

      <View style={styles.actions}>
        <ActionButton
          label="Đọc lại"
          hint="Đọc lại kết quả bằng giọng nói"
          onPress={onReadAgain}
          style={styles.action}
        />
        <ActionButton
          label="Quét lượt mới"
          hint="Xóa ảnh hiện tại và bắt đầu lượt đọc mới"
          onPress={onRetry}
          variant="secondary"
          style={styles.action}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0d2845",
    borderColor: "#68b7ff",
    borderWidth: 2,
    borderRadius: 20,
    padding: 18,
    gap: 10,
  },
  demoBadge: {
    alignSelf: "flex-start",
    color: "#111111",
    backgroundColor: "#ffd400",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontWeight: "900",
  },
  title: { color: "#ffffff", fontSize: 26, fontWeight: "900" },
  body: { color: "#ffffff", fontSize: 20, lineHeight: 29 },
  detail: { color: "#dcecff", fontSize: 18, lineHeight: 26 },
  warning: { color: "#ffe476", fontSize: 19, lineHeight: 27 },
  healthCard: {
    backgroundColor: "#12385e",
    borderLeftColor: "#ffd400",
    borderLeftWidth: 5,
    padding: 14,
    gap: 8,
  },
  healthTitle: { color: "#ffffff", fontSize: 20, fontWeight: "900" },
  healthSubtitle: { color: "#ffffff", fontSize: 18, fontWeight: "800" },
  verdict: { color: "#ffe476", fontSize: 24, fontWeight: "900" },
  healthReason: { color: "#ffffff", fontSize: 17, lineHeight: 25 },
  medicalNote: { color: "#c6dff7", fontSize: 15, lineHeight: 21 },
  note: { color: "#c6dff7", fontSize: 16, lineHeight: 23 },
  actions: { flexDirection: "row", gap: 12, marginTop: 8 },
  action: { flex: 1 },
});
