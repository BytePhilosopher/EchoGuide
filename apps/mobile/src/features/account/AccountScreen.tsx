import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Theme } from '../../design/theme';
import {
  Card,
  SectionHeader,
  SettingRow,
  PrimaryButton,
  StatusBadge,
  IconCircle,
  Divider,
} from '../../design/SharedComponents';
import { useAppState } from '../../state/AppStateContext';

export const AccountScreen: React.FC = () => {
  const { state } = useAppState();

  // Compute usage stats
  const totalCommands = state.commandHistory.length;
  const successCount = state.commandHistory.filter((c) => c.outcome === 'done').length;
  const successRate = totalCommands > 0 ? Math.round((successCount / totalCommands) * 100) : 0;

  // Masked device hash display
  const maskedHash = 'SHA256•••••a7f3';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Account</Text>
      <Text style={styles.headerSub}>መለያ</Text>

      {/* ─── Profile Card ──────────────────────────────────────── */}
      <Card elevated style={styles.profileCard}>
        <View style={styles.profileRow}>
          <IconCircle icon="👤" color={Theme.colors.text} bgColor={Theme.colors.secondary} size={56} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>EchoGuide User</Text>
            <Text style={styles.profileId}>Device: {maskedHash}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Text style={styles.profileLang}>
                {state.selectedLanguage === 'am-ET' ? '🇪🇹 አማርኛ' : '🇺🇸 English'}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      {/* ─── Subscription ──────────────────────────────────────── */}
      <SectionHeader title="Subscription" subtitle="የደንበኝነት ምዝገባ" />

      <Card style={styles.subscriptionCard}>
        <View style={styles.subHeader}>
          <View>
            <Text style={styles.planName}>{state.subscription.plan}</Text>
            <Text style={styles.planRenewal}>
              {state.subscription.renewsAt
                ? `Renews: ${new Date(state.subscription.renewsAt).toLocaleDateString()}`
                : 'No active subscription'}
            </Text>
          </View>
          <StatusBadge status={state.subscription.status === 'active' ? 'active' : 'inactive'} label={state.subscription.status.toUpperCase()} />
        </View>

        <Divider spacing={Theme.spacing.sm} />

        <View style={styles.usageRow}>
          <View style={styles.usageStat}>
            <Text style={styles.usageValue}>{state.subscription.commandsThisPeriod}</Text>
            <Text style={styles.usageLabel}>Commands This Period</Text>
          </View>
          <View style={[styles.usageStat, styles.usageStatBorder]}>
            <Text style={[styles.usageValue, { color: Theme.colors.success }]}>{successRate}%</Text>
            <Text style={styles.usageLabel}>Success Rate</Text>
          </View>
          <View style={styles.usageStat}>
            <Text style={[styles.usageValue, { color: Theme.colors.info }]}>{totalCommands}</Text>
            <Text style={styles.usageLabel}>All Time</Text>
          </View>
        </View>

        <PrimaryButton
          title="Manage Subscription"
          icon="💳"
          onPress={() => Alert.alert('Coming Soon', 'Subscription management will be available in a future update.')}
          variant="secondary"
          style={{ marginTop: Theme.spacing.md }}
        />
      </Card>

      {/* ─── Usage Summary ─────────────────────────────────────── */}
      <SectionHeader title="Usage Summary" subtitle="የአጠቃቀም ማጠቃለያ" />

      <SettingRow
        icon="📊"
        label="Total Commands"
        description="All-time voice commands processed"
        rightElement={<Text style={styles.statText}>{totalCommands}</Text>}
      />
      <SettingRow
        icon="✅"
        label="Successful"
        description="Commands completed without error"
        rightElement={<Text style={[styles.statText, { color: Theme.colors.success }]}>{successCount}</Text>}
      />
      <SettingRow
        icon="❌"
        label="Failed / Rejected"
        description="Commands that were blocked or failed"
        rightElement={
          <Text style={[styles.statText, { color: Theme.colors.danger }]}>
            {totalCommands - successCount}
          </Text>
        }
      />

      {/* ─── Consent Audit Trail ───────────────────────────────── */}
      <SectionHeader title="Consent Audit Trail" subtitle="የፈቃድ ምዝግብ ማስታወሻ (§9.3)" />

      {state.consentTrail.length === 0 ? (
        <Card>
          <Text style={styles.emptyTrail}>No consent events recorded yet.</Text>
        </Card>
      ) : (
        state.consentTrail.slice(0, 10).map((event) => (
          <Card key={event.id} style={styles.trailCard}>
            <View style={styles.trailRow}>
              <IconCircle
                icon={event.granted ? '✓' : '✗'}
                color={event.granted ? Theme.colors.success : Theme.colors.danger}
                bgColor={event.granted ? Theme.colors.successMuted : Theme.colors.dangerMuted}
                size={32}
              />
              <View style={styles.trailInfo}>
                <Text style={styles.trailScope}>{event.scope.replace(/_/g, ' ')}</Text>
                <Text style={styles.trailTime}>
                  {new Date(event.timestamp).toLocaleString()}
                </Text>
              </View>
              <StatusBadge status={event.granted ? 'done' : 'rejected'} label={event.granted ? 'Granted' : 'Revoked'} />
            </View>
          </Card>
        ))
      )}

      {/* ─── Actions ───────────────────────────────────────────── */}
      <SectionHeader title="Account Actions" />

      <PrimaryButton
        title="Sign Out"
        icon="🚪"
        onPress={() => Alert.alert('Sign Out', 'Sign out functionality will be available in a future update.')}
        variant="ghost"
        style={{ marginBottom: Theme.spacing.xxl }}
      />

      <View style={{ height: Theme.spacing.xxl }} />
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
  header: {
    fontSize: Theme.typography.fontSizeHeader,
    color: Theme.colors.text,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: Theme.typography.fontSizeSmall,
    color: Theme.colors.textMuted,
    marginBottom: Theme.spacing.sm,
  },
  profileCard: {
    marginTop: Theme.spacing.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    marginLeft: Theme.spacing.md,
    flex: 1,
  },
  profileName: {
    fontSize: Theme.typography.fontSizeSubheader,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  profileId: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  profileLang: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textSecondary,
  },
  subscriptionCard: {
    marginTop: Theme.spacing.sm,
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {
    fontSize: Theme.typography.fontSizeSubheader,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  planRenewal: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  usageRow: {
    flexDirection: 'row',
  },
  usageStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Theme.spacing.sm,
  },
  usageStatBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Theme.colors.border,
  },
  usageValue: {
    fontSize: Theme.typography.fontSizeHeader,
    fontWeight: '800',
    color: Theme.colors.text,
  },
  usageLabel: {
    fontSize: Theme.typography.fontSizeMicro,
    color: Theme.colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  statText: {
    fontSize: Theme.typography.fontSizeSubheader,
    fontWeight: '800',
    color: Theme.colors.text,
  },
  emptyTrail: {
    fontSize: Theme.typography.fontSizeSmall,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    padding: Theme.spacing.md,
  },
  trailCard: {
    marginBottom: Theme.spacing.xs,
  },
  trailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trailInfo: {
    flex: 1,
    marginLeft: Theme.spacing.sm,
  },
  trailScope: {
    fontSize: Theme.typography.fontSizeSmall,
    fontWeight: '600',
    color: Theme.colors.text,
    textTransform: 'capitalize',
  },
  trailTime: {
    fontSize: Theme.typography.fontSizeMicro,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
});
