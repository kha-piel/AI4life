import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";

import { ActionButton } from "./src/components/ActionButton";
import { ResultCard } from "./src/components/ResultCard";
import {
  getLabelTargetOption,
  LABEL_TARGET_OPTIONS,
} from "./src/domain/labelTargets";
import type { LabelTarget } from "./src/domain/types";
import {
  analyzeLabel,
  ApiClientError,
  APP_AUTH_REQUIRED,
  validateAccessCode,
} from "./src/services/apiClient";
import {
  clearAccessToken,
  getAccessToken,
  saveAccessToken,
} from "./src/services/accessToken";
import {
  signalError,
  speak,
  stopSpeaking,
} from "./src/services/feedback";
import {
  initialVisionState,
  visionReducer,
} from "./src/state/visionReducer";

const CAMERA_RETRY_DELAY_MS = 400;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function takePictureReliably(camera: CameraView): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const photo = await camera.takePictureAsync({ quality: 0.62 });
      if (photo?.uri) return photo.uri;
      lastError = new Error("Camera did not return an image URI");
    } catch (error) {
      lastError = error;
    }
    if (attempt === 1) await wait(CAMERA_RETRY_DELAY_MS);
  }
  throw lastError ?? new Error("Camera capture failed");
}

function HomeScreen({
  onSelect,
  onChangeAccessCode,
}: {
  onSelect: (target: LabelTarget) => void;
  onChangeAccessCode?: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.home}
      accessibilityLabel="Màn hình chọn thông tin cần đọc"
    >
      <Text style={styles.eyebrow}>AIVISION</Text>
      <Text style={styles.heading} accessibilityRole="header">
        Bạn muốn đọc gì?
      </Text>
      <Text style={styles.lead}>
        Chọn một mục trước khi mở camera. Ứng dụng sẽ chỉ đọc đúng thông tin bạn
        cần.
      </Text>

      <View style={styles.homeActions}>
        {LABEL_TARGET_OPTIONS.map((option, index) => (
          <ActionButton
            key={option.value}
            label={option.label}
            hint={option.hint}
            onPress={() => onSelect(option.value)}
            variant={index === 0 ? "primary" : "secondary"}
          />
        ))}
      </View>

      <View style={styles.safetyCard}>
        <Text style={styles.safetyTitle}>Chỉ đọc nội dung nhìn thấy</Text>
        <Text style={styles.safetyText}>
          Ứng dụng không suy đoán hạn sử dụng, thành phần hoặc hướng dẫn y tế. Nếu
          ảnh chưa rõ, hãy chụp gần phần chữ cần đọc.
        </Text>
      </View>

      {onChangeAccessCode ? (
        <ActionButton
          label="Đổi mã truy cập"
          hint="Xóa mã hiện tại và nhập mã mời khác"
          onPress={onChangeAccessCode}
          variant="secondary"
        />
      ) : null}
    </ScrollView>
  );
}

function AccessSetupScreen({ onAuthorized }: { onAuthorized: () => void }) {
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const connect = useCallback(async () => {
    const normalized = accessCode.trim();
    if (!normalized) {
      setError("Hãy nhập mã mời do người quản lý ứng dụng cung cấp.");
      return;
    }

    setIsChecking(true);
    setError(null);
    try {
      await validateAccessCode(normalized);
      await saveAccessToken(normalized);
      onAuthorized();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await speak("Đã kết nối máy chủ an toàn.");
    } catch (caught) {
      const message =
        caught instanceof ApiClientError
          ? caught.message
          : "Không thể kiểm tra mã truy cập lúc này.";
      setError(message);
      await signalError();
      await speak(message);
    } finally {
      setIsChecking(false);
    }
  }, [accessCode, onAuthorized]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.disclaimer}>
        <Text style={styles.eyebrow}>BẢN THỬ NGHIỆM RIÊNG TƯ</Text>
        <Text style={styles.heading} accessibilityRole="header">
          Nhập mã truy cập
        </Text>
        <Text style={styles.lead}>
          Mã được lưu an toàn trên thiết bị và không nằm trong file APK.
        </Text>
        <TextInput
          accessibilityLabel="Mã truy cập"
          accessibilityHint="Nhập mã mời do người quản lý ứng dụng cung cấp"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isChecking}
          onChangeText={setAccessCode}
          onSubmitEditing={() => void connect()}
          placeholder="Nhập mã mời"
          placeholderTextColor="#91a8bf"
          secureTextEntry
          style={styles.accessInput}
          value={accessCode}
        />
        {error ? (
          <Text style={styles.errorText} accessibilityLiveRegion="assertive">
            {error}
          </Text>
        ) : null}
        <ActionButton
          label={isChecking ? "Đang kiểm tra…" : "Kết nối"}
          hint="Kiểm tra mã và mở ứng dụng"
          disabled={isChecking}
          onPress={() => void connect()}
        />
      </View>
    </SafeAreaView>
  );
}

function LabelCameraScreen({
  target,
  onBack,
}: {
  target: LabelTarget;
  onBack: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const busyRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [state, dispatch] = useReducer(visionReducer, initialVisionState);
  const option = getLabelTargetOption(target);

  const reportError = useCallback(async (error: unknown) => {
    const message =
      error instanceof ApiClientError
        ? error.message
        : "Không chụp được ảnh. Hãy giữ điện thoại ổn định rồi thử lại.";
    dispatch({ type: "ERROR", message });
    await signalError();
    await speak(message);
  }, []);

  const captureLabel = useCallback(async () => {
    if (busyRef.current) return;
    if (!cameraRef.current || !cameraReady) {
      await reportError(
        new ApiClientError("Camera chưa sẵn sàng. Hãy đợi một chút rồi thử lại.", "camera_not_ready"),
      );
      return;
    }

    busyRef.current = true;
    dispatch({ type: "CAPTURE" });
    try {
      const uri = await takePictureReliably(cameraRef.current);
      dispatch({ type: "ANALYZE" });
      const result = await analyzeLabel(uri, target);
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
  }, [cameraReady, reportError, target]);

  useEffect(
    () => () => {
      void stopSpeaking();
    },
    [],
  );

  const goBack = useCallback(() => {
    void stopSpeaking();
    onBack();
  }, [onBack]);

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
            Ảnh chỉ được gửi khi bạn chủ động nhấn nút chụp.
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
  const statusText = cameraError
    ? cameraError
    : isBusy
      ? state.phase === "capturing"
        ? "Đang chụp ảnh…"
        : "Đang đọc nhãn…"
      : state.error ??
        (cameraReady ? option.cameraGuide : "Đang khởi động camera…");

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.topBar}>
        <ActionButton
          label="Quay lại"
          hint="Chọn mục thông tin khác"
          onPress={goBack}
          variant="secondary"
          style={styles.backButton}
        />
        <Text style={styles.modeTitle} accessibilityRole="header">
          {option.label}
        </Text>
      </View>

      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        autofocus="on"
        onCameraReady={() => {
          setCameraError(null);
          setCameraReady(true);
        }}
        onMountError={(event) => {
          setCameraReady(false);
          setCameraError(`Không mở được camera: ${event.message}`);
        }}
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
          {statusText}
        </Text>

        <ActionButton
          label={
            isBusy
              ? state.phase === "capturing"
                ? "Đang chụp…"
                : "Đang đọc…"
              : `Chụp ${option.label.toLocaleLowerCase("vi-VN")}`
          }
          hint={`Chụp nhãn để đọc ${option.label.toLocaleLowerCase("vi-VN")}`}
          onPress={() => void captureLabel()}
          disabled={!cameraReady || isBusy || cameraError !== null}
        />

        {state.result ? (
          <ResultCard
            result={state.result}
            onReadAgain={() => void speak(state.result!.speech_text)}
            onRetry={() => dispatch({ type: "RESET" })}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  const [selectedTarget, setSelectedTarget] = useState<LabelTarget | null>(null);
  const [accessState, setAccessState] = useState<
    "loading" | "required" | "authorized"
  >(APP_AUTH_REQUIRED ? "loading" : "authorized");

  useEffect(() => {
    if (!APP_AUTH_REQUIRED) return;
    let active = true;
    void getAccessToken()
      .then((token) => {
        if (active) setAccessState(token ? "authorized" : "required");
      })
      .catch(() => {
        if (active) setAccessState("required");
      });
    return () => {
      active = false;
    };
  }, []);

  if (accessState === "loading") {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#ffd400" />
        <Text style={styles.status}>Đang mở kho mã truy cập…</Text>
      </SafeAreaView>
    );
  }

  if (accessState === "required") {
    return <AccessSetupScreen onAuthorized={() => setAccessState("authorized")} />;
  }

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="light" />
      {selectedTarget === null ? (
        <HomeScreen
          onSelect={setSelectedTarget}
          onChangeAccessCode={
            APP_AUTH_REQUIRED
              ? () => {
                  void clearAccessToken().then(() => {
                    setSelectedTarget(null);
                    setAccessState("required");
                  });
                }
              : undefined
          }
        />
      ) : (
        <LabelCameraScreen
          target={selectedTarget}
          onBack={() => setSelectedTarget(null)}
        />
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
  heading: { color: "#ffffff", fontSize: 36, fontWeight: "900" },
  lead: { color: "#dcecff", fontSize: 21, lineHeight: 31 },
  homeActions: { gap: 14, marginVertical: 8 },
  safetyCard: {
    borderLeftWidth: 5,
    borderLeftColor: "#ffd400",
    backgroundColor: "#0d2845",
    padding: 18,
    gap: 8,
  },
  safetyTitle: { color: "#ffe476", fontWeight: "900", fontSize: 20 },
  safetyText: { color: "#ffffff", fontSize: 17, lineHeight: 25 },
  accessInput: {
    minHeight: 58,
    borderWidth: 2,
    borderColor: "#68b7ff",
    borderRadius: 14,
    paddingHorizontal: 16,
    color: "#ffffff",
    backgroundColor: "#0d2845",
    fontSize: 19,
  },
  errorText: { color: "#ffb4ab", fontSize: 17, lineHeight: 24 },
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
  modeTitle: { color: "#ffffff", fontSize: 24, fontWeight: "900", flex: 1 },
  camera: {
    flex: 1,
    minHeight: 260,
    justifyContent: "center",
    alignItems: "center",
  },
  reticle: {
    width: "82%",
    height: "62%",
    borderWidth: 4,
    borderColor: "#ffd400",
    borderRadius: 24,
  },
  controlPanel: {
    maxHeight: "55%",
    backgroundColor: "#06121f",
  },
  controlPanelContent: {
    padding: 14,
    gap: 12,
  },
  status: { color: "#ffffff", fontSize: 18, lineHeight: 26, textAlign: "center" },
});
