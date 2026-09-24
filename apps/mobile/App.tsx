import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";

import { ActionButton } from "./src/components/ActionButton";
import { ResultCard } from "./src/components/ResultCard";
import { getLabelTargetOption } from "./src/domain/labelTargets";
import {
  MAX_LABEL_IMAGES,
  mergeImageUris,
} from "./src/domain/imageSelection";
import type { HealthCondition, LabelTarget } from "./src/domain/types";
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
  onStart,
  healthCondition,
  onHealthConditionChange,
  onChangeAccessCode,
}: {
  onStart: () => void;
  healthCondition: HealthCondition | null;
  onHealthConditionChange: (condition: HealthCondition | null) => void;
  onChangeAccessCode?: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.home}
      accessibilityLabel="Màn hình đọc và phân tích nhãn"
    >
      <Text style={styles.eyebrow}>AIVISION</Text>
      <Text style={styles.heading} accessibilityRole="header">
        Đọc và phân tích nhãn
      </Text>
      <Text style={styles.lead}>
        Chụp các mặt của cùng một sản phẩm. AIVision sẽ đọc tên, hạn sử dụng,
        thành phần, hướng dẫn và bảng dinh dưỡng trong một lượt.
      </Text>

      <Text style={styles.sectionTitle}>Phân tích theo sức khỏe</Text>
      <Text style={styles.sectionHint}>
        Không bắt buộc. Thông tin này chỉ được gửi trong lượt phân tích hiện tại.
      </Text>
      <View style={styles.homeActions}>
        <ActionButton
          label={healthCondition === null ? "Không chọn bệnh nền — đã chọn" : "Không chọn bệnh nền"}
          hint="Chỉ đọc toàn bộ thông tin trên nhãn"
          onPress={() => onHealthConditionChange(null)}
          variant={healthCondition === null ? "primary" : "secondary"}
        />
        <ActionButton
          label={healthCondition === "diabetes" ? "Tiểu đường — đã chọn" : "Tiểu đường"}
          hint="Phân tích carbohydrate, đường, chất xơ và thành phần nhìn thấy"
          onPress={() => onHealthConditionChange("diabetes")}
          variant={healthCondition === "diabetes" ? "primary" : "secondary"}
        />
        <ActionButton
          label="Bắt đầu đọc nhãn"
          hint="Mở camera để chụp hoặc chọn ảnh sản phẩm"
          onPress={onStart}
        />
      </View>

      <View style={styles.safetyCard}>
        <Text style={styles.safetyTitle}>Hỗ trợ sàng lọc, không chẩn đoán</Text>
        <Text style={styles.safetyText}>
          Kết quả sức khỏe chỉ dựa trên nhãn nhìn thấy và không thay thế bác sĩ.
          Để phân tích tiểu đường, hãy chụp rõ cả bảng dinh dưỡng và thành phần.
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
  healthCondition,
  onBack,
}: {
  target: LabelTarget;
  healthCondition: HealthCondition | null;
  onBack: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const busyRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isPicking, setIsPicking] = useState(false);
  const [state, dispatch] = useReducer(visionReducer, initialVisionState);
  const option = getLabelTargetOption(target);

  const reportError = useCallback(async (error: unknown) => {
    const message =
      error instanceof ApiClientError
        ? error.message
        : "Không xử lý được ảnh. Hãy giữ điện thoại ổn định rồi thử lại.";
    dispatch({ type: "ERROR", message });
    await signalError();
    await speak(message);
  }, []);

  const captureImage = useCallback(async () => {
    if (busyRef.current) return;
    if (selectedImages.length >= MAX_LABEL_IMAGES) return;
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
      const nextImages = mergeImageUris(selectedImages, [uri]);
      setSelectedImages(nextImages);
      dispatch({ type: "GUIDE" });
      await Haptics.selectionAsync();
      await speak(
        `Đã thêm ảnh ${nextImages.length}. ${
          nextImages.length < MAX_LABEL_IMAGES
            ? "Bạn có thể chụp thêm hoặc phân tích ngay."
            : "Đã đủ ba ảnh, hãy nhấn phân tích."
        }`,
      );
    } catch (error) {
      await reportError(error);
    } finally {
      busyRef.current = false;
    }
  }, [cameraReady, reportError, selectedImages]);

  const pickImages = useCallback(async () => {
    if (busyRef.current) return;
    const remaining = MAX_LABEL_IMAGES - selectedImages.length;
    if (remaining <= 0) return;

    busyRef.current = true;
    setIsPicking(true);
    try {
      const selection = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.7,
      });
      if (selection.canceled) return;

      const nextImages = mergeImageUris(
        selectedImages,
        selection.assets.map((asset) => asset.uri),
      );
      const addedCount = nextImages.length - selectedImages.length;
      setSelectedImages(nextImages);
      dispatch({ type: "GUIDE" });
      if (addedCount > 0) {
        await Haptics.selectionAsync();
        await speak(`Đã chọn thêm ${addedCount} ảnh từ thư viện.`);
      }
    } catch (error) {
      await reportError(error);
    } finally {
      setIsPicking(false);
      busyRef.current = false;
    }
  }, [reportError, selectedImages]);

  const analyzeImages = useCallback(async () => {
    if (busyRef.current) return;
    if (selectedImages.length === 0) {
      await reportError(
        new ApiClientError(
          "Hãy chụp hoặc chọn ít nhất một ảnh nhãn.",
          "image_required",
        ),
      );
      return;
    }

    busyRef.current = true;
    dispatch({ type: "ANALYZE" });
    try {
      const result = await analyzeLabel(
        selectedImages,
        target,
        undefined,
        healthCondition ?? undefined,
      );
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
  }, [healthCondition, reportError, selectedImages, target]);

  useEffect(() => {
    let active = true;
    void ImagePicker.getPendingResultAsync()
      .then((pending) => {
        if (
          active &&
          pending &&
          "canceled" in pending &&
          !pending.canceled
        ) {
          setSelectedImages((current) =>
            mergeImageUris(
              current,
              pending.assets.map((asset) => asset.uri),
            ),
          );
        }
      })
      .catch(() => {
        // A pending picker result is optional recovery, not a blocking error.
      });
    return () => {
      active = false;
    };
  }, []);

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

  const isBusy =
    state.phase === "capturing" || state.phase === "analyzing" || isPicking;
  const statusText = cameraError
    ? cameraError
    : isBusy
      ? isPicking
        ? "Đang mở thư viện ảnh…"
        : state.phase === "capturing"
        ? "Đang chụp ảnh…"
        : "Đang đọc nhãn…"
      : state.error ??
        (selectedImages.length > 0
          ? `Đã chọn ${selectedImages.length}/${MAX_LABEL_IMAGES} ảnh. Các ảnh phải thuộc cùng một sản phẩm.`
          : cameraReady
            ? option.cameraGuide
            : permission?.granted
              ? "Đang khởi động camera…"
              : "Bạn có thể cho phép camera hoặc chọn ảnh từ thư viện.");

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

      {permission?.granted ? (
        <View style={styles.cameraFrame}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
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
          />
          <View pointerEvents="none" style={styles.reticle} />
        </View>
      ) : (
        <View style={styles.cameraPlaceholder}>
          {permission === null ? (
            <ActivityIndicator size="large" color="#ffd400" />
          ) : (
            <>
              <Text style={styles.cameraPlaceholderTitle}>Camera chưa được phép</Text>
              <ActionButton
                label="Cho phép camera"
                hint="Cho phép chụp nhiều ảnh nhãn"
                onPress={() => void requestPermission()}
              />
            </>
          )}
        </View>
      )}

      <ScrollView
        style={styles.controlPanel}
        contentContainerStyle={styles.controlPanelContent}
      >
        <Text style={styles.status} accessibilityLiveRegion="assertive">
          {statusText}
        </Text>

        {selectedImages.length > 0 ? (
          <View style={styles.previewRow} accessibilityLabel="Các ảnh đã chọn">
            {selectedImages.map((uri, index) => (
              <View key={uri} style={styles.previewItem}>
                <Image
                  source={{ uri }}
                  style={styles.previewImage}
                  accessibilityLabel={`Ảnh đã chọn ${index + 1}`}
                />
                <Text style={styles.previewNumber}>{index + 1}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <ActionButton
          label={`Chụp thêm ảnh (${selectedImages.length}/${MAX_LABEL_IMAGES})`}
          hint="Chụp một mặt nhãn và thêm vào lượt phân tích"
          onPress={() => void captureImage()}
          disabled={
            !cameraReady ||
            isBusy ||
            cameraError !== null ||
            selectedImages.length >= MAX_LABEL_IMAGES
          }
        />

        <ActionButton
          label="Chọn ảnh từ thư viện"
          hint="Chọn một hoặc nhiều ảnh nhãn có sẵn trên điện thoại"
          onPress={() => void pickImages()}
          disabled={isBusy || selectedImages.length >= MAX_LABEL_IMAGES}
          variant="secondary"
        />

        <ActionButton
          label={`Phân tích ${selectedImages.length} ảnh`}
          hint={`Gửi ${selectedImages.length} ảnh đã chọn để đọc ${option.label.toLocaleLowerCase("vi-VN")}`}
          onPress={() => void analyzeImages()}
          disabled={isBusy || selectedImages.length === 0}
        />

        {selectedImages.length > 0 ? (
          <ActionButton
            label="Xóa ảnh đã chọn"
            hint="Xóa toàn bộ ảnh khỏi lượt phân tích hiện tại"
            onPress={() => {
              setSelectedImages([]);
              dispatch({ type: "RESET" });
              void stopSpeaking();
            }}
            disabled={isBusy}
            variant="secondary"
          />
        ) : null}

        {state.result ? (
          <ResultCard
            result={state.result}
            onReadAgain={() => void speak(state.result!.speech_text)}
            onRetry={() => {
              setSelectedImages([]);
              dispatch({ type: "RESET" });
              void stopSpeaking();
            }}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  const [selectedTarget, setSelectedTarget] = useState<LabelTarget | null>(null);
  const [healthCondition, setHealthCondition] = useState<HealthCondition | null>(null);
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
          onStart={() => setSelectedTarget("all")}
          healthCondition={healthCondition}
          onHealthConditionChange={setHealthCondition}
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
          healthCondition={healthCondition}
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
  sectionTitle: { color: "#ffffff", fontSize: 22, fontWeight: "900" },
  sectionHint: { color: "#c6dff7", fontSize: 16, lineHeight: 23 },
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
  cameraFrame: {
    flex: 1,
    minHeight: 260,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  cameraPlaceholder: {
    flex: 1,
    minHeight: 260,
    justifyContent: "center",
    alignItems: "center",
    gap: 18,
    padding: 24,
    backgroundColor: "#0d2845",
  },
  cameraPlaceholderTitle: { color: "#ffffff", fontSize: 21, fontWeight: "800" },
  reticle: {
    width: "82%",
    height: "62%",
    borderWidth: 4,
    borderColor: "#ffd400",
    borderRadius: 24,
  },
  controlPanel: {
    maxHeight: "64%",
    backgroundColor: "#06121f",
  },
  controlPanelContent: {
    padding: 14,
    gap: 12,
  },
  status: { color: "#ffffff", fontSize: 18, lineHeight: 26, textAlign: "center" },
  previewRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  previewItem: { position: "relative" },
  previewImage: {
    width: 76,
    height: 76,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#68b7ff",
    backgroundColor: "#0d2845",
  },
  previewNumber: {
    position: "absolute",
    right: 4,
    bottom: 4,
    minWidth: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
    backgroundColor: "#ffd400",
    color: "#06121f",
    fontWeight: "900",
    textAlign: "center",
  },
});
