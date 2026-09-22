import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";

import { ActionButton } from "./src/components/ActionButton";
import { ResultCard } from "./src/components/ResultCard";
import {
  filterNovelHazards,
  type HazardMemory,
} from "./src/domain/hazardDedup";
import type {
  CaptureMode,
  LabelAnalysis,
  SceneAnalysis,
} from "./src/domain/types";
import { analyzeLabel, analyzeScene, ApiClientError } from "./src/services/apiClient";
import {
  signalError,
  signalHazard,
  speak,
  stopSpeaking,
} from "./src/services/feedback";
import {
  initialVisionState,
  visionReducer,
} from "./src/state/visionReducer";

type Screen = "home" | CaptureMode;

function HomeScreen({ onSelect }: { onSelect: (screen: CaptureMode) => void }) {
  return (
    <ScrollView
      contentContainerStyle={styles.home}
      accessibilityLabel="Màn hình chính Đôi Mắt AI"
    >
      <Text style={styles.eyebrow}>AI4LIFE · MVP</Text>
      <Text style={styles.heading} accessibilityRole="header">
        Đôi Mắt AI
      </Text>
      <Text style={styles.lead}>
        Đọc nhãn và nhận biết một số nguy cơ trong nhà bằng camera điện thoại.
      </Text>

      <View style={styles.homeActions}>
        <ActionButton
          label="Đọc nhãn"
          hint="Mở camera để đọc chữ trên chai lọ, bao bì hoặc hộp thuốc"
          onPress={() => onSelect("label")}
        />
        <ActionButton
          label="Thám hiểm"
          hint="Mở chế độ quét cảnh và cảnh báo nguy cơ giới hạn"
          onPress={() => onSelect("scene")}
          variant="secondary"
        />
      </View>

      <View style={styles.safetyCard}>
        <Text style={styles.safetyTitle}>Lưu ý an toàn</Text>
        <Text style={styles.safetyText}>
          Ứng dụng không thay thế gậy, chó dẫn đường, người hỗ trợ hoặc tư vấn y
          tế. Hãy kiểm tra lại khi thông tin quan trọng không rõ.
        </Text>
      </View>
    </ScrollView>
  );
}

function VisionScreen({
  mode,
  onBack,
}: {
  mode: CaptureMode;
  onBack: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const busyRef = useRef(false);
  const hazardMemoryRef = useRef<HazardMemory>({});
  const [state, dispatch] = useReducer(visionReducer, initialVisionState);
  const [sceneDisclaimerAccepted, setSceneDisclaimerAccepted] = useState(false);
  const [sceneEnabled, setSceneEnabled] = useState(false);

  const reportError = useCallback(async (error: unknown) => {
    const message =
      error instanceof ApiClientError
        ? error.message
        : "Không thể xử lý ảnh. Vui lòng thử lại.";
    dispatch({ type: "ERROR", message });
    await signalError();
    await speak(message);
  }, []);

  const captureLabel = useCallback(async () => {
    if (busyRef.current || !cameraRef.current) return;
    busyRef.current = true;
    dispatch({ type: "CAPTURE" });
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.72,
      });
      if (!photo?.uri) throw new Error("Camera did not return an image");
      dispatch({ type: "ANALYZE" });
      const result = await analyzeLabel(photo.uri);
      dispatch({
        type: "SUCCESS",
        result,
        lowConfidence: result.confidence === "low",
      });
      await Haptics.notificationAsync(
        result.confidence === "low"
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success,
      );
      await speak(result.speech_text);
    } catch (error) {
      await reportError(error);
    } finally {
      busyRef.current = false;
    }
  }, [reportError]);

  const captureScene = useCallback(async () => {
    if (busyRef.current || !cameraRef.current || !sceneEnabled) return;
    busyRef.current = true;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.52,
      });
      if (!photo?.uri) throw new Error("Camera did not return an image");
      const result = await analyzeScene(photo.uri);
      const { novel, nextMemory } = filterNovelHazards(
        result.hazards,
        hazardMemoryRef.current,
        Date.now(),
      );
      hazardMemoryRef.current = nextMemory;
      dispatch({
        type: "SUCCESS",
        result,
        lowConfidence:
          result.hazards.length > 0 &&
          result.hazards.every((hazard) => hazard.confidence === "low"),
      });

      for (const hazard of novel) {
        await signalHazard(hazard.urgency);
      }
      if (novel.length > 0) {
        await speak(novel.map((hazard) => hazard.speech_text).join(" "));
      }
    } catch (error) {
      setSceneEnabled(false);
      await reportError(error);
    } finally {
      busyRef.current = false;
    }
  }, [reportError, sceneEnabled]);

  useEffect(() => {
    if (!sceneEnabled) return;
    void captureScene();
    const timer = setInterval(() => {
      void captureScene();
    }, 3_000);
    return () => clearInterval(timer);
  }, [captureScene, sceneEnabled]);

  useEffect(
    () => () => {
      void stopSpeaking();
    },
    [],
  );

  const goBack = useCallback(() => {
    setSceneEnabled(false);
    void stopSpeaking();
    onBack();
  }, [onBack]);

  if (mode === "scene" && !sceneDisclaimerAccepted) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.disclaimer}>
          <Text style={styles.heading} accessibilityRole="header">
            Trước khi Thám hiểm
          </Text>
          <Text style={styles.lead}>
            Chế độ này phân tích ảnh theo nhịp, có thể bỏ sót hoặc cảnh báo sai.
            Không dùng để thay thế công cụ hỗ trợ di chuyển.
          </Text>
          <ActionButton
            label="Tôi hiểu, bắt đầu"
            hint="Xác nhận giới hạn và mở camera"
            onPress={() => {
              setSceneDisclaimerAccepted(true);
              dispatch({ type: "GUIDE" });
            }}
          />
          <ActionButton label="Quay lại" onPress={goBack} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  if (permission === null) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#ffd400" />
        <Text style={styles.status}>Đang kiểm tra quyền camera…</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.disclaimer}>
          <Text style={styles.heading} accessibilityRole="header">
            Cần quyền camera
          </Text>
          <Text style={styles.lead}>
            Ảnh chỉ được gửi khi bạn chủ động chụp hoặc bật Thám hiểm.
          </Text>
          <ActionButton
            label="Cho phép camera"
            onPress={() => void requestPermission()}
          />
          <ActionButton label="Quay lại" onPress={goBack} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  const isBusy = state.phase === "capturing" || state.phase === "analyzing";
  const isLabelResult =
    state.result !== null && "speech_text" in state.result;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.topBar}>
        <ActionButton
          label="Quay lại"
          hint="Trở về màn hình chính"
          onPress={goBack}
          variant="secondary"
          style={styles.backButton}
        />
        <Text style={styles.modeTitle} accessibilityRole="header">
          {mode === "label" ? "Đọc nhãn" : "Thám hiểm"}
        </Text>
      </View>

      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        autofocus="on"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.reticle} />
      </CameraView>

      <ScrollView
        style={styles.controlPanel}
        contentContainerStyle={styles.controlPanelContent}
      >
        <Text style={styles.status} accessibilityLiveRegion="assertive">
          {isBusy
            ? state.phase === "capturing"
              ? "Đang chụp ảnh…"
              : "Đang phân tích…"
            : state.error ??
              (mode === "label"
                ? "Đưa nhãn vào giữa camera rồi nhấn Chụp và đọc."
                : sceneEnabled
                  ? "Đang quét cảnh mỗi 3 giây."
                  : "Nhấn Bắt đầu quét khi đã sẵn sàng.")}
        </Text>

        {mode === "label" ? (
          <ActionButton
            label="Chụp và đọc"
            hint="Chụp nhãn hiện tại và đọc kết quả"
            onPress={() => void captureLabel()}
            disabled={isBusy}
          />
        ) : (
          <ActionButton
            label={sceneEnabled ? "Dừng quét" : "Bắt đầu quét"}
            hint={
              sceneEnabled
                ? "Dừng gửi ảnh để phân tích"
                : "Bắt đầu phân tích một ảnh mỗi 3 giây"
            }
            onPress={() => {
              const next = !sceneEnabled;
              setSceneEnabled(next);
              dispatch({ type: next ? "SCAN_START" : "STOP" });
              if (!next) void stopSpeaking();
            }}
            variant={sceneEnabled ? "danger" : "primary"}
          />
        )}

        {state.result ? (
          <ResultCard
            result={state.result}
            onReadAgain={() => {
              const text = isLabelResult
                ? (state.result as LabelAnalysis).speech_text
                : (state.result as SceneAnalysis).hazards
                    .map((hazard) => hazard.speech_text)
                    .join(" ");
              void speak(text || "Chưa phát hiện nguy cơ trong ảnh hiện tại.");
            }}
            onRetry={() => dispatch({ type: "RESET" })}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="light" />
      {screen === "home" ? (
        <HomeScreen onSelect={setScreen} />
      ) : (
        <VisionScreen mode={screen} onBack={() => setScreen("home")} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#06121f" },
  screen: { flex: 1, backgroundColor: "#06121f" },
  centered: {
    flex: 1,
    backgroundColor: "#06121f",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    padding: 24,
  },
  home: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
    gap: 22,
    backgroundColor: "#06121f",
  },
  eyebrow: {
    color: "#68b7ff",
    fontWeight: "900",
    letterSpacing: 1.5,
    fontSize: 15,
  },
  heading: { color: "#ffffff", fontSize: 38, fontWeight: "900" },
  lead: { color: "#dcecff", fontSize: 21, lineHeight: 31 },
  homeActions: { gap: 16, marginVertical: 8 },
  safetyCard: {
    borderLeftWidth: 5,
    borderLeftColor: "#ffd400",
    backgroundColor: "#0d2845",
    padding: 18,
    gap: 8,
  },
  safetyTitle: { color: "#ffe476", fontWeight: "900", fontSize: 20 },
  safetyText: { color: "#ffffff", fontSize: 17, lineHeight: 25 },
  disclaimer: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backButton: { minHeight: 48, paddingHorizontal: 14 },
  modeTitle: { color: "#ffffff", fontSize: 25, fontWeight: "900" },
  camera: {
    flex: 1,
    minHeight: 260,
    justifyContent: "center",
    alignItems: "center",
  },
  reticle: {
    width: "76%",
    height: "58%",
    borderWidth: 4,
    borderColor: "#ffd400",
    borderRadius: 24,
  },
  controlPanel: {
    maxHeight: "52%",
    backgroundColor: "#06121f",
  },
  controlPanelContent: {
    padding: 14,
    gap: 12,
  },
  status: { color: "#ffffff", fontSize: 18, lineHeight: 26, textAlign: "center" },
});
