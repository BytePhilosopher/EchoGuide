import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ViewStyle,
} from 'react-native';
import { Theme } from './theme';

/* ─── Card ────────────────────────────────────────────────────── */
interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
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
  badge?: string;
}
export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, badge }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {badge && (
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionBadgeText}>{badge}</Text>
        </View>
      )}
    </View>
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
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
    )}
    <View style={{ flex: 1, paddingRight: Theme.spacing.xs }}>
      <Text style={styles.settingLabel}>{label}</Text>
      {description && <Text style={styles.settingDescription}>{description}</Text>}
    </View>
    {onValueChange !== undefined && value !== undefined ? (
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Theme.colors.border, true: Theme.colors.primary }}
        thumbColor={value ? '#FFFFFF' : Theme.colors.textMuted}
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
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'glow';
  icon?: string;
  style?: ViewStyle | ViewStyle[];
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
    glow: Theme.colors.primary,
  };
  const textMap: Record<string, string> = {
    primary: '#080C14',
    secondary: '#FFFFFF',
    danger: '#FFFFFF',
    ghost: Theme.colors.textSecondary,
    glow: '#080C14',
  };
  const borderMap: Record<string, string> = {
    primary: Theme.colors.primary,
    secondary: Theme.colors.secondary,
    danger: Theme.colors.danger,
    ghost: Theme.colors.border,
    glow: Theme.colors.primary,
  };

  return (
    <TouchableOpacity
      style={[
        styles.primaryButton,
        {
          backgroundColor: disabled ? Theme.colors.borderSubtle : bgMap[variant],
          borderColor: disabled ? Theme.colors.border : borderMap[variant],
        },
        variant === 'glow' && !disabled && Theme.shadow.glow,
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
          { color: disabled ? Theme.colors.textMuted : textMap[variant] },
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
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    done: { bg: Theme.colors.successMuted, text: Theme.colors.success, border: 'rgba(16, 185, 129, 0.4)' },
    confirmed: { bg: Theme.colors.primaryMuted, text: Theme.colors.primary, border: 'rgba(0, 229, 255, 0.4)' },
    active: { bg: Theme.colors.successMuted, text: Theme.colors.success, border: 'rgba(16, 185, 129, 0.4)' },
    failed: { bg: Theme.colors.dangerMuted, text: Theme.colors.danger, border: 'rgba(239, 68, 68, 0.4)' },
    rejected: { bg: Theme.colors.dangerMuted, text: Theme.colors.danger, border: 'rgba(239, 68, 68, 0.4)' },
    blocked: { bg: Theme.colors.warningMuted, text: Theme.colors.warning, border: 'rgba(245, 158, 11, 0.4)' },
    cancelled: { bg: Theme.colors.warningMuted, text: Theme.colors.warning, border: 'rgba(245, 158, 11, 0.4)' },
    inactive: { bg: Theme.colors.borderSubtle, text: Theme.colors.textMuted, border: Theme.colors.border },
  };
  const colors = colorMap[status] || colorMap.inactive;

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
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
  size = 48,
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
      opacity: 0.7,
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
    marginTop: Theme.spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: Theme.typography.fontSizeCaption,
    fontWeight: '800',
    color: Theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  sectionBadge: {
    backgroundColor: Theme.colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Theme.borderRadius.xs,
  },
  sectionBadgeText: {
    fontSize: Theme.typography.fontSizeMicro,
    color: Theme.colors.primary,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceElevated,
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: Theme.spacing.sm,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Theme.colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.colors.borderSubtle,
  },
  settingLabel: {
    fontSize: Theme.typography.fontSizeBody,
    color: Theme.colors.text,
    fontWeight: '700',
  },
  settingDescription: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
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
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: Theme.typography.fontSizeMicro,
    fontWeight: '800',
    letterSpacing: 0.8,
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
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: Theme.colors.primary,
    width: 24,
  },
  dotInactive: {
    backgroundColor: Theme.colors.border,
    width: 6,
  },
});
