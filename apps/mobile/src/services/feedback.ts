import { AccessibilityInfo } from "react-native";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";

import type { SceneHazard } from "../domain/types";

export async function speak(text: string): Promise<void> {
  await Speech.stop();
  AccessibilityInfo.announceForAccessibility(text);
  Speech.speak(text, {
    language: "vi-VN",
    rate: 0.9,
    pitch: 1,
  });
}

export async function stopSpeaking(): Promise<void> {
  await Speech.stop();
}

export async function signalHazard(
  urgency: SceneHazard["urgency"],
): Promise<void> {
  if (urgency === "urgent") {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    return;
  }
  if (urgency === "warning") {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    return;
  }
  await Haptics.selectionAsync();
}

export async function signalError(): Promise<void> {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

