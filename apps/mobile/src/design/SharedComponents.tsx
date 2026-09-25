import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  type AccessibilityRole,
  type ViewStyle,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Theme } from './theme';

interface SurfaceProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];

  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
}

export const Card: React.FC<SurfaceProps> = ({
  children,
  style,
  accessible,
  accessibilityLabel,
  accessibilityRole,
}) => (
  <View
    style={[styles.card, style]}
    accessible={accessible}
    accessibilityLabel={accessibilityLabel}
    accessibilityRole={accessibilityRole}
  >
    {children}
  </View>
);

export const SectionHeader: React.FC<{ title: string; subtitle?: string }> = ({
  title,
  subtitle,
}) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.overline} accessibilityRole="header">
      {title}
    </Text>
    {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
  </View>
);

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
  style?: ViewStyle | ViewStyle[];
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const PrimaryButton: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon: Icon,
  style,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const isDisabled = disabled || loading;
  const tone = BUTTON_TONES[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: tone.bg, borderColor: tone.border },
        pressed && !isDisabled && styles.buttonPressed,
        isDisabled && styles.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone.ink} size="small" />
      ) : (
        <>
          {Icon ? <Icon size={20} color={isDisabled ? Theme.colors.muted : tone.ink} /> : null}
          <Text
            style={[
              styles.buttonLabel,
              { color: isDisabled ? Theme.colors.muted : tone.ink },
              Icon ? styles.buttonLabelWithIcon : null,
            ]}
            numberOfLines={2}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
};

const BUTTON_TONES = {
  primary: { bg: Theme.colors.accent, ink: Theme.colors.accentInk, border: Theme.colors.accent },
  secondary: { bg: 'transparent', ink: Theme.colors.strong, border: Theme.colors.lineStrong },
  danger: { bg: 'transparent', ink: Theme.colors.danger, border: Theme.colors.danger },
} as const;

export type StatusTone = 'positive' | 'negative' | 'neutral';

export const StatusBadge: React.FC<{ tone: StatusTone; label: string }> = ({ tone, label }) => {
  const style = STATUS_TONES[tone];
  return (
    <View style={[styles.badge, { borderColor: style.border, backgroundColor: style.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: style.ink }]} />
      <Text style={[styles.badgeLabel, { color: style.ink }]}>{label}</Text>
    </View>
  );
};

const STATUS_TONES = {
  positive: { ink: Theme.colors.accent, bg: Theme.colors.accentSoft, border: 'rgba(224,182,74,0.35)' },
  negative: { ink: Theme.colors.danger, bg: Theme.colors.dangerSoft, border: 'rgba(240,133,125,0.35)' },
  neutral: { ink: Theme.colors.muted, bg: 'transparent', border: Theme.colors.line },
} as const;

interface SettingRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}

export const SettingRow: React.FC<SettingRowProps> = ({
  label,
  description,
  value,
  onValueChange,
}) => (
  <View style={styles.settingRow}>
    <View style={styles.settingText}>
      <Text style={styles.settingLabel}>{label}</Text>
      {description ? <Text style={styles.settingDescription}>{description}</Text> : null}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      trackColor={{ false: Theme.colors.line, true: Theme.colors.accent }}
      thumbColor={Theme.colors.strong}
    />
  </View>
);

export const EmptyState: React.FC<{ icon?: LucideIcon; title: string; body?: string }> = ({
  icon: Icon,
  title,
  body,
}) => (
  <View style={styles.empty} accessible accessibilityLabel={body ? `${title}. ${body}` : title}>
    {Icon ? <Icon size={28} color={Theme.colors.muted} strokeWidth={1.5} /> : null}
    <Text style={styles.emptyTitle}>{title}</Text>
    {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
  </View>
);

export const Divider: React.FC<{ spacing?: number }> = ({ spacing = Theme.spacing.md }) => (
  <View style={[styles.divider, { marginVertical: spacing }]} />
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.raised,
    borderRadius: Theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.line,
    padding: Theme.spacing.md,
  },
  sectionHeader: {
    marginTop: Theme.spacing.lg,
    marginBottom: Theme.spacing.sm,
  },
  overline: {
    ...Theme.type.overline,
    color: Theme.colors.muted,
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    ...Theme.type.caption,
    color: Theme.colors.muted,
    marginTop: Theme.spacing.xs,
  },
  button: {
    minHeight: Theme.touchTarget,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    backgroundColor: 'transparent',
    borderColor: Theme.colors.line,
  },
  buttonLabel: {
    ...Theme.type.bodyStrong,
    textAlign: 'center',
  },
  buttonLabelWithIcon: {
    marginLeft: Theme.spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Theme.radius.pill,
    paddingVertical: 5,
    paddingHorizontal: Theme.spacing.sm + 2,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  badgeLabel: {
    ...Theme.type.caption,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Theme.touchTarget,
    paddingVertical: Theme.spacing.sm,
  },
  settingText: {
    flex: 1,
    paddingRight: Theme.spacing.md,
  },
  settingLabel: {
    ...Theme.type.body,
    color: Theme.colors.strong,
  },
  settingDescription: {
    ...Theme.type.caption,
    color: Theme.colors.muted,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xxl,
    paddingHorizontal: Theme.spacing.lg,
  },
  emptyTitle: {
    ...Theme.type.body,
    color: Theme.colors.base,
    marginTop: Theme.spacing.md,
    textAlign: 'center',
  },
  emptyBody: {
    ...Theme.type.caption,
    color: Theme.colors.muted,
    marginTop: Theme.spacing.xs,
    textAlign: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Theme.colors.line,
  },
});
