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
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  primary: { backgroundColor: "#ffd400" },
  secondary: { backgroundColor: "#143c68" },
  danger: { backgroundColor: "#a31414" },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.45 },
  label: {
    color: "#06121f",
    fontWeight: "800",
    fontSize: 20,
    textAlign: "center",
  },
  labelOnDark: { color: "#ffffff" },
});
