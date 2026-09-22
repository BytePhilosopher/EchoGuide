import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Theme } from './theme';

/* ─── Card ────────────────────────────────────────────────────── */
interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
}
export const Card: React.FC<CardProps> = ({ children, style, elevated }) => (
  <View
    style={[
      styles.card,
      elevated && Theme.shadow.elevated,
      style,
    ]}
  >
    {children}
  </View>
);

/* ─── Section Header ──────────────────────────────────────────── */
interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}
export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
  </View>
);

/* ─── Setting Row ─────────────────────────────────────────────── */
interface SettingRowProps {
  icon?: string;
  label: string;
  description?: string;
  value?: boolean;
  onValueChange?: (v: boolean) => void;
  rightElement?: React.ReactNode;
}
export const SettingRow: React.FC<SettingRowProps> = ({
  icon,
  label,
  description,
  value,
  onValueChange,
  rightElement,
}) => (
  <View style={styles.settingRow}>
    {icon && (
      <View style={styles.settingIcon}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>
    )}
    <View style={{ flex: 1 }}>
      <Text style={styles.settingLabel}>{label}</Text>
      {description && <Text style={styles.settingDescription}>{description}</Text>}
    </View>
    {onValueChange !== undefined && value !== undefined ? (
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Theme.colors.border, true: Theme.colors.primary }}
        thumbColor={value ? Theme.colors.text : Theme.colors.textMuted}
      />
    ) : (
      rightElement
    )}
  </View>
);

/* ─── Primary Button ──────────────────────────────────────────── */
interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: string;
  style?: ViewStyle;
}
export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  onPress,
  disabled,
  variant = 'primary',
  icon,
  style,
}) => {
  const bgMap: Record<string, string> = {
    primary: Theme.colors.primary,
    secondary: Theme.colors.secondary,
    danger: Theme.colors.danger,
    ghost: 'transparent',
  };
  const borderMap: Record<string, string> = {
    primary: Theme.colors.primary,
    secondary: Theme.colors.secondary,
    danger: Theme.colors.danger,
    ghost: Theme.colors.border,
  };

  return (
    <TouchableOpacity
      style={[
        styles.primaryButton,
        {
          backgroundColor: disabled ? Theme.colors.borderSubtle : bgMap[variant],
          borderColor: disabled ? Theme.colors.border : borderMap[variant],
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      {icon && <Text style={{ fontSize: 18, marginRight: 8 }}>{icon}</Text>}
      <Text
        style={[
          styles.primaryButtonText,
          disabled && { color: Theme.colors.textMuted },
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
};

/* ─── Status Badge ────────────────────────────────────────────── */
interface StatusBadgeProps {
  status: 'done' | 'failed' | 'rejected' | 'blocked' | 'cancelled' | 'confirmed' | 'active' | 'inactive';
  label?: string;
}
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const colorMap: Record<string, { bg: string; text: string }> = {
    done: { bg: Theme.colors.successMuted, text: Theme.colors.success },
    confirmed: { bg: Theme.colors.successMuted, text: Theme.colors.success },
    active: { bg: Theme.colors.successMuted, text: Theme.colors.success },
    failed: { bg: Theme.colors.dangerMuted, text: Theme.colors.danger },
    rejected: { bg: Theme.colors.dangerMuted, text: Theme.colors.danger },
    blocked: { bg: Theme.colors.warningMuted, text: Theme.colors.warning },
    cancelled: { bg: Theme.colors.warningMuted, text: Theme.colors.warning },
    inactive: { bg: Theme.colors.borderSubtle, text: Theme.colors.textMuted },
  };
  const colors = colorMap[status] || colorMap.inactive;

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.badgeText, { color: colors.text }]}>
        {label || status.toUpperCase()}
      </Text>
    </View>
  );
};

/* ─── Icon Circle ─────────────────────────────────────────────── */
interface IconCircleProps {
  icon: string;
  color: string;
  bgColor: string;
  size?: number;
}
export const IconCircle: React.FC<IconCircleProps> = ({
  icon,
  color,
  bgColor,
  size = 44,
}) => (
  <View
    style={[
      styles.iconCircle,
      { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor },
    ]}
  >
    <Text style={{ fontSize: size * 0.45, color }}>{icon}</Text>
  </View>
);

/* ─── Progress Dots ───────────────────────────────────────────── */
interface ProgressDotsProps {
  total: number;
  current: number;
}
export const ProgressDots: React.FC<ProgressDotsProps> = ({ total, current }) => (
  <View style={styles.dotsContainer}>
    {Array.from({ length: total }).map((_, i) => (
      <View
        key={i}
        style={[
          styles.dot,
          i === current ? styles.dotActive : styles.dotInactive,
        ]}
      />
    ))}
  </View>
);

/* ─── Divider ─────────────────────────────────────────────────── */
export const Divider: React.FC<{ spacing?: number }> = ({ spacing = Theme.spacing.md }) => (
  <View
    style={{
      height: 1,
      backgroundColor: Theme.colors.border,
      marginVertical: spacing,
    }}
  />
);

/* ─── Styles ──────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.cardBackground,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    ...Theme.shadow.card,
  },
  sectionHeader: {
    marginBottom: Theme.spacing.sm,
    marginTop: Theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: Theme.typography.fontSizeSmall,
    fontWeight: '700',
    color: Theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  sectionSubtitle: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.cardBackground,
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: Theme.spacing.sm,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.sm,
  },
  settingLabel: {
    fontSize: Theme.typography.fontSizeBody,
    color: Theme.colors.text,
    fontWeight: '600',
  },
  settingDescription: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
  },
  primaryButtonText: {
    fontSize: Theme.typography.fontSizeBody,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.full,
  },
  badgeText: {
    fontSize: Theme.typography.fontSizeMicro,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: Theme.colors.primary,
    width: 24,
  },
  dotInactive: {
    backgroundColor: Theme.colors.border,
  },
});
