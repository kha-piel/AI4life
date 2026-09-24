import { StyleSheet, Text, View } from "react-native";

import { expiryToVietnamese } from "../domain/format";
import { getLabelTargetOption } from "../domain/labelTargets";
import type { LabelAnalysis } from "../domain/types";
import { ActionButton } from "./ActionButton";

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
          label="Chụp lại"
          hint="Quay về camera để thử lại"
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
  note: { color: "#c6dff7", fontSize: 16, lineHeight: 23 },
  actions: { flexDirection: "row", gap: 12, marginTop: 8 },
  action: { flex: 1 },
});
