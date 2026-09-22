import { StyleSheet, Text, View } from "react-native";

import { expiryToVietnamese } from "../domain/format";
import type { LabelAnalysis, SceneAnalysis } from "../domain/types";
import { ActionButton } from "./ActionButton";

type Props = {
  result: LabelAnalysis | SceneAnalysis;
  onReadAgain: () => void;
  onRetry: () => void;
};

function isLabelResult(
  result: LabelAnalysis | SceneAnalysis,
): result is LabelAnalysis {
  return "speech_text" in result;
}

export function ResultCard({ result, onReadAgain, onRetry }: Props) {
  const title = isLabelResult(result)
    ? result.product_name ?? "Chưa xác định sản phẩm"
    : result.hazards.length > 0
      ? "Đã phát hiện nguy cơ"
      : "Chưa thấy nguy cơ trong ảnh";

  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      {result.demo_mode ? (
        <Text style={styles.demoBadge}>CHẾ ĐỘ DỮ LIỆU MẪU</Text>
      ) : null}
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>

      {isLabelResult(result) ? (
        <>
          {result.expiry_date ? (
            <Text style={styles.body}>
              Hạn sử dụng: {expiryToVietnamese(result.expiry_date)}
            </Text>
          ) : null}
          <Text style={styles.body}>{result.speech_text}</Text>
          {result.unreadable_fields.length > 0 ? (
            <Text style={styles.warning}>
              Chưa đọc rõ: {result.unreadable_fields.join(", ")}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          {result.hazards.map((hazard) => (
            <Text
              key={`${hazard.type}-${hazard.direction}`}
              style={styles.warning}
            >
              {hazard.speech_text}
            </Text>
          ))}
          {result.limitations.map((item) => (
            <Text key={item} style={styles.note}>
              {item}
            </Text>
          ))}
        </>
      )}

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
  warning: { color: "#ffe476", fontSize: 19, lineHeight: 27 },
  note: { color: "#c6dff7", fontSize: 16, lineHeight: 23 },
  actions: { flexDirection: "row", gap: 12, marginTop: 8 },
  action: { flex: 1 },
});

