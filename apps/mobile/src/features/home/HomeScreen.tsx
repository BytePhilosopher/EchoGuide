import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Theme } from '../../design/theme';
import { Card, IconCircle, StatusBadge, Divider } from '../../design/SharedComponents';
import { useAppState } from '../../state/AppStateContext';

/**
 * HomeScreen — Voice Hub Placeholder (§5.1 compliant)
 * Displays current state and readiness indicators.
 * No pipeline logic — only reads state from AppStateContext.
 */
export const HomeScreen: React.FC = () => {
  const { state } = useAppState();

  // Today's stats
  const today = new Date().toDateString();
  const todayCommands = state.commandHistory.filter(
    (c) => new Date(c.timestamp).toDateString() === today
  );
  const todaySuccess = todayCommands.filter((c) => c.outcome === 'done').length;
  const todayRate = todayCommands.length > 0 ? Math.round((todaySuccess / todayCommands.length) * 100) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ─── Header ────────────────────────────────────────────── */}
      <View style={styles.headerSection}>
        <Text style={styles.greeting}>
          {state.selectedLanguage === 'am-ET' ? 'ሰላም 👋' : 'Hello 👋'}
        </Text>
        <Text style={styles.headerTitle}>EchoGuide</Text>
        <Text style={styles.headerSub}>
          {state.selectedLanguage === 'am-ET'
            ? 'የድምጽ ተደራሽነት ረዳት'
            : 'Voice Accessibility Assistant'}
        </Text>
      </View>

      {/* ─── Service Status Card ───────────────────────────────── */}
      <Card elevated style={styles.statusCard}>
        <View style={styles.statusRow}>
          <IconCircle
            icon={state.accessibilityServiceEnabled ? '🟢' : '🔴'}
            color={state.accessibilityServiceEnabled ? Theme.colors.success : Theme.colors.danger}
            bgColor={state.accessibilityServiceEnabled ? Theme.colors.successMuted : Theme.colors.dangerMuted}
            size={56}
          />
          <View style={styles.statusInfo}>
            <Text style={styles.statusTitle}>
              {state.accessibilityServiceEnabled ? 'Ready to Listen' : 'Service Disabled'}
            </Text>
            <Text style={styles.statusDesc}>
              {state.accessibilityServiceEnabled
                ? `Say "${state.wakeWord}" to activate voice control`
                : 'Enable the Accessibility Service in Android Settings'}
            </Text>
          </View>
        </View>

        <Divider spacing={Theme.spacing.sm} />

        <View style={styles.statusDetails}>
          <View style={styles.statusDetail}>
            <Text style={styles.detailLabel}>Language</Text>
            <Text style={styles.detailValue}>
              {state.selectedLanguage === 'am-ET' ? '🇪🇹 አማርኛ' : '🇺🇸 English'}
            </Text>
          </View>
          <View style={[styles.statusDetail, styles.statusDetailBorder]}>
            <Text style={styles.detailLabel}>Consent</Text>
            <StatusBadge
              status={state.consentGranted ? 'active' : 'inactive'}
              label={state.consentGranted ? 'Granted' : 'Required'}
            />
          </View>
          <View style={styles.statusDetail}>
            <Text style={styles.detailLabel}>Wake Word</Text>
            <Text style={styles.detailValue}>"{state.wakeWord}"</Text>
          </View>
        </View>
      </Card>

      {/* ─── Listening State Indicator ─────────────────────────── */}
      <Card style={styles.listeningCard}>
        <View style={styles.listeningContent}>
          <View style={[
            styles.pulseOuter,
            { backgroundColor: state.accessibilityServiceEnabled ? Theme.colors.primaryMuted : Theme.colors.borderSubtle },
          ]}>
            <View style={[
              styles.pulseInner,
              { backgroundColor: state.accessibilityServiceEnabled ? Theme.colors.primary : Theme.colors.border },
            ]}>
              <Text style={styles.pulseIcon}>
                {state.accessibilityServiceEnabled ? '🎙️' : '🔇'}
              </Text>
            </View>
          </View>
          <Text style={styles.listeningTitle}>
            {state.accessibilityServiceEnabled ? 'Listening for Wake Word' : 'Voice Control Inactive'}
          </Text>
          <Text style={styles.listeningDesc}>
            {state.accessibilityServiceEnabled
              ? `The pipeline is running natively. Say "${state.wakeWord}" followed by your command.`
              : 'Enable the Accessibility Service to start using voice commands.'}
          </Text>
        </View>
      </Card>

      {/* ─── Today's Stats ─────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>TODAY'S ACTIVITY</Text>
      <View style={styles.statsRow}>
        <Card style={styles.miniStat}>
          <Text style={styles.miniStatValue}>{todayCommands.length}</Text>
          <Text style={styles.miniStatLabel}>Commands</Text>
        </Card>
        <Card style={[styles.miniStat, { borderColor: Theme.colors.success }]}>
          <Text style={[styles.miniStatValue, { color: Theme.colors.success }]}>{todaySuccess}</Text>
          <Text style={styles.miniStatLabel}>Successful</Text>
        </Card>
        <Card style={[styles.miniStat, { borderColor: Theme.colors.info }]}>
          <Text style={[styles.miniStatValue, { color: Theme.colors.info }]}>{todayRate}%</Text>
          <Text style={styles.miniStatLabel}>Rate</Text>
        </Card>
      </View>

      {/* ─── Quick Tips ────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>QUICK TIPS</Text>
      <Card style={{ marginBottom: Theme.spacing.xxl }}>
        <View style={styles.tipRow}>
          <Text style={styles.tipIcon}>💡</Text>
          <Text style={styles.tipText}>
            {state.selectedLanguage === 'am-ET'
              ? '"Echo, መልእክት ላክ" — ለመላክ ይህንን ይናገሩ'
              : '"Echo, send a message" — opens your messaging app'}
          </Text>
        </View>
        <Divider spacing={Theme.spacing.xs} />
        <View style={styles.tipRow}>
          <Text style={styles.tipIcon}>💡</Text>
          <Text style={styles.tipText}>
            {state.selectedLanguage === 'am-ET'
              ? '"Echo, ቅንብሮችን ክፈት" — ቅንብሮችን ለመክፈት'
              : '"Echo, open settings" — navigates to your phone settings'}
          </Text>
        </View>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    padding: Theme.spacing.md,
    paddingTop: Theme.spacing.xxl,
  },
  headerSection: {
    marginBottom: Theme.spacing.md,
  },
  greeting: {
    fontSize: Theme.typography.fontSizeSmall,
    color: Theme.colors.textMuted,
  },
  headerTitle: {
    fontSize: Theme.typography.fontSizeHero,
    fontWeight: '800',
    color: Theme.colors.text,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: Theme.typography.fontSizeSmall,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  statusCard: {
    marginBottom: Theme.spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusInfo: {
    marginLeft: Theme.spacing.md,
    flex: 1,
  },
  statusTitle: {
    fontSize: Theme.typography.fontSizeSubheader,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  statusDesc: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  statusDetails: {
    flexDirection: 'row',
  },
  statusDetail: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Theme.spacing.xs,
  },
  statusDetailBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Theme.colors.border,
  },
  detailLabel: {
    fontSize: Theme.typography.fontSizeMicro,
    color: Theme.colors.textMuted,
    fontWeight: '600',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.text,
    fontWeight: '600',
  },
  listeningCard: {
    marginBottom: Theme.spacing.md,
    backgroundColor: Theme.colors.surfaceElevated,
  },
  listeningContent: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.md,
  },
  pulseOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseIcon: {
    fontSize: 28,
  },
  listeningTitle: {
    fontSize: Theme.typography.fontSizeBody,
    fontWeight: '700',
    color: Theme.colors.text,
    marginTop: Theme.spacing.md,
  },
  listeningDesc: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    marginTop: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.md,
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: Theme.typography.fontSizeMicro,
    fontWeight: '700',
    color: Theme.colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },
  miniStat: {
    flex: 1,
    alignItems: 'center',
    padding: Theme.spacing.sm,
  },
  miniStatValue: {
    fontSize: Theme.typography.fontSizeHeader,
    fontWeight: '800',
    color: Theme.colors.text,
  },
  miniStatLabel: {
    fontSize: Theme.typography.fontSizeMicro,
    color: Theme.colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Theme.spacing.xs,
  },
  tipIcon: {
    fontSize: 14,
    marginRight: Theme.spacing.sm,
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    fontSize: Theme.typography.fontSizeSmall,
    color: Theme.colors.textSecondary,
    lineHeight: 20,
  },
});
