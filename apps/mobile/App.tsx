import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { ActionButton } from "./src/components/ActionButton";
import { ResultCard } from "./src/components/ResultCard";
import { getLabelTargetOption } from "./src/domain/labelTargets";
import {
  MAX_LABEL_IMAGES,
  mergeImageUris,
} from "./src/domain/imageSelection";
import { DEFAULT_SCAN_PROFILE } from "./src/domain/scanProfile";
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
  onChangeAccessCode,
}: {
  onStart: () => void;
  onChangeAccessCode?: () => void;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.home}
        accessibilityLabel="Màn hình chính AIVision"
      >
        <View style={styles.brandRow}>
          <View style={styles.brandMark} accessibilityElementsHidden>
            <Text style={styles.brandMarkText}>AI</Text>
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>AIVision</Text>
            <Text style={styles.brandTagline}>Trợ lý đọc nhãn thông minh</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>ĐỌC NHÃN DỄ DÀNG HƠN</Text>
          <Text style={styles.heading} accessibilityRole="header">
            Hiểu sản phẩm.{"\n"}Chọn an tâm hơn.
          </Text>
          <Text style={styles.lead}>
            Chụp tối đa ba mặt nhãn. AIVision đọc thông tin quan trọng và phân
            tích dinh dưỡng dành cho người tiểu đường.
          </Text>
        </View>

        <View style={styles.featureCard}>
          <View style={styles.featureBadge}>
            <Text style={styles.featureBadgeText}>TIỂU ĐƯỜNG</Text>
          </View>
          <Text style={styles.featureTitle}>Một lần quét, đầy đủ thông tin</Text>
          <View style={styles.featureList}>
            <Text style={styles.featureItem}>✓ Tên, hạn sử dụng và hướng dẫn</Text>
            <Text style={styles.featureItem}>✓ Thành phần và bảng dinh dưỡng</Text>
            <Text style={styles.featureItem}>✓ Gợi ý cân nhắc, hạn chế hoặc tránh</Text>
          </View>
          <ActionButton
            label="Bắt đầu đọc nhãn"
            hint="Mở camera và tự động phân tích cho người tiểu đường"
            onPress={onStart}
            style={styles.primaryCta}
          />
          <Text style={styles.privacyNote}>
            Hồ sơ tiểu đường chỉ được gửi trong lượt phân tích, không lưu trên máy chủ.
          </Text>
        </View>

        <View style={styles.safetyCard}>
          <Text style={styles.safetyIcon} accessibilityElementsHidden>!</Text>
          <View style={styles.safetyCopy}>
            <Text style={styles.safetyTitle}>Hỗ trợ sàng lọc, không chẩn đoán</Text>
            <Text style={styles.safetyText}>
              Hãy chụp rõ bảng dinh dưỡng và thành phần. Kết quả không thay thế
              bác sĩ hoặc chuyên gia dinh dưỡng.
            </Text>
          </View>
        </View>

        {onChangeAccessCode ? (
          <ActionButton
            label="Đổi mã truy cập"
            hint="Xóa mã hiện tại và nhập mã mời khác"
            onPress={onChangeAccessCode}
            variant="secondary"
            style={styles.tertiaryAction}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
  onBack,
}: {
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
  const option = getLabelTargetOption(DEFAULT_SCAN_PROFILE.requestedField);

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
        DEFAULT_SCAN_PROFILE.requestedField,
        undefined,
        DEFAULT_SCAN_PROFILE.healthCondition,
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
  }, [reportError, selectedImages]);

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
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View style={styles.topBar}>
        <ActionButton
          label="‹  Home"
          hint="Quay về màn hình chính"
          onPress={goBack}
          variant="secondary"
          style={styles.backButton}
        />
        <View style={styles.cameraTitleGroup}>
          <Text style={styles.modeTitle} accessibilityRole="header">
            Quét nhãn
          </Text>
          <Text style={styles.modeSubtitle}>Phân tích tiểu đường</Text>
        </View>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>{selectedImages.length}/3</Text>
        </View>
      </View>

      {permission?.granted ? (
        <View style={styles.cameraShell}>
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
          <View pointerEvents="none" style={styles.cameraHintBadge}>
            <Text style={styles.cameraHintText}>Căn nhãn trong khung</Text>
          </View>
          </View>
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
        <View style={styles.statusCard}>
          <View style={styles.statusDot} />
          <Text
            style={[styles.status, styles.statusInCard]}
            accessibilityLiveRegion="assertive"
          >
            {statusText}
          </Text>
        </View>

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

function AIVisionApp() {
  const [isScanning, setIsScanning] = useState(false);
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
    <View style={styles.app}>
      <StatusBar style="light" />
      {!isScanning ? (
        <HomeScreen
          onStart={() => setIsScanning(true)}
          onChangeAccessCode={
            APP_AUTH_REQUIRED
              ? () => {
                  void clearAccessToken().then(() => {
                    setIsScanning(false);
                    setAccessState("required");
                  });
                }
              : undefined
          }
        />
      ) : (
        <LabelCameraScreen
          onBack={() => setIsScanning(false)}
        />
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AIVisionApp />
    </SafeAreaProvider>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 20,
    backgroundColor: "#06121f",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandMark: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#68b7ff",
  },
  brandMarkText: { color: "#06121f", fontSize: 19, fontWeight: "900" },
  brandCopy: { flex: 1 },
  brandName: { color: "#ffffff", fontSize: 22, fontWeight: "900" },
  brandTagline: { color: "#91a8bf", fontSize: 14, marginTop: 1 },
  hero: { gap: 12, paddingTop: 12 },
  eyebrow: {
    color: "#7bc2ff",
    fontWeight: "900",
    letterSpacing: 1.8,
    fontSize: 13,
  },
  heading: {
    color: "#ffffff",
    fontSize: 39,
    lineHeight: 45,
    fontWeight: "900",
    letterSpacing: -1,
  },
  lead: { color: "#c6dff7", fontSize: 18, lineHeight: 28 },
  featureCard: {
    borderRadius: 24,
    padding: 20,
    gap: 14,
    backgroundColor: "#0d2845",
    borderWidth: 1,
    borderColor: "#214f7e",
  },
  featureBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: "#173d63",
  },
  featureBadgeText: {
    color: "#8dcbff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  featureTitle: { color: "#ffffff", fontSize: 24, fontWeight: "900" },
  featureList: { gap: 9 },
  featureItem: { color: "#e5f2ff", fontSize: 16, lineHeight: 23 },
  primaryCta: { minHeight: 64, marginTop: 4 },
  privacyNote: {
    color: "#91a8bf",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  safetyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 18,
    backgroundColor: "#10253a",
    padding: 16,
    gap: 13,
  },
  safetyIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#ffd400",
    color: "#06121f",
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 28,
  },
  safetyCopy: { flex: 1, gap: 5 },
  safetyTitle: { color: "#ffffff", fontWeight: "900", fontSize: 17 },
  safetyText: { color: "#b9d0e5", fontSize: 15, lineHeight: 22 },
  tertiaryAction: { minHeight: 50, backgroundColor: "transparent" },
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
    gap: 12,
    minHeight: 70,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "#06121f",
    borderBottomWidth: 1,
    borderBottomColor: "#17324c",
  },
  backButton: {
    minHeight: 46,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 14,
  },
  cameraTitleGroup: { flex: 1 },
  modeTitle: { color: "#ffffff", fontSize: 20, fontWeight: "900" },
  modeSubtitle: { color: "#91a8bf", fontSize: 13, marginTop: 2 },
  stepBadge: {
    minWidth: 42,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#143c68",
  },
  stepBadgeText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  cameraShell: {
    paddingHorizontal: 12,
    paddingTop: 12,
    backgroundColor: "#06121f",
  },
  cameraFrame: {
    height: 330,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#214f7e",
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
    width: "84%",
    height: "60%",
    borderWidth: 3,
    borderColor: "#ffd400",
    borderRadius: 20,
  },
  cameraHintBadge: {
    position: "absolute",
    bottom: 16,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(6, 18, 31, 0.82)",
  },
  cameraHintText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  controlPanel: {
    flex: 1,
    backgroundColor: "#06121f",
  },
  controlPanelContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 30,
    gap: 12,
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 16,
    padding: 13,
    backgroundColor: "#0d2845",
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 7,
    backgroundColor: "#68b7ff",
  },
  status: { color: "#e5f2ff", fontSize: 16, lineHeight: 23 },
  statusInCard: { flex: 1 },
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
