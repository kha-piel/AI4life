import {
  Pressable,
  StyleSheet,
  Text,
  type AccessibilityRole,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type Props = {
  label: string;
  hint?: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  style?: StyleProp<ViewStyle>;
  accessibilityRole?: AccessibilityRole;
};

export function ActionButton({
  label,
  hint,
  onPress,
  disabled = false,
  variant = "primary",
  style,
  accessibilityRole = "button",
}: Props) {
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[styles.label, variant !== "primary" && styles.labelOnDark]}
        allowFontScaling
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  primary: {
    backgroundColor: "#ffd400",
    borderColor: "#ffe45c",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  secondary: {
    backgroundColor: "#143c68",
    borderColor: "#2b5d8e",
  },
  danger: { backgroundColor: "#a31414", borderColor: "#d54b4b" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.38, elevation: 0 },
  label: {
    color: "#06121f",
    fontWeight: "800",
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
  },
  labelOnDark: { color: "#ffffff" },
});
