import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Theme } from '../../design/theme';
import { Card, StatusBadge, IconCircle, PrimaryButton, SectionHeader } from '../../design/SharedComponents';
import { useAppState, CommandOutcome } from '../../state/AppStateContext';

/* ─── Stage Timing Mini Bar ───────────────────────────────────── */
const TimingBar: React.FC<{ timing?: CommandOutcome['stageTiming']; totalMs: number }> = ({
  timing,
  totalMs,
}) => {
  if (!timing) return null;
  const stt = timing.sttMs || 0;
  const llm = timing.llmMs || 0;
  const exec = timing.execMs || 0;
  const total = stt + llm + exec || 1;

  return (
    <View style={timingStyles.container}>
      <View style={timingStyles.barRow}>
        {stt > 0 && (
          <View style={[timingStyles.segment, { flex: stt / total, backgroundColor: Theme.colors.info }]} />
        )}
        {llm > 0 && (
          <View style={[timingStyles.segment, { flex: llm / total, backgroundColor: Theme.colors.accent }]} />
        )}
        {exec > 0 && (
          <View style={[timingStyles.segment, { flex: exec / total, backgroundColor: Theme.colors.success }]} />
        )}
      </View>
      <View style={timingStyles.legend}>
        {stt > 0 && <Text style={[timingStyles.legendText, { color: Theme.colors.info }]}>STT {stt}ms</Text>}
        {llm > 0 && <Text style={[timingStyles.legendText, { color: Theme.colors.accent }]}>LLM {llm}ms</Text>}
        {exec > 0 && <Text style={[timingStyles.legendText, { color: Theme.colors.success }]}>Exec {exec}ms</Text>}
      </View>
    </View>
  );
};

const timingStyles = StyleSheet.create({
  container: { marginTop: Theme.spacing.sm },
  barRow: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: Theme.colors.borderSubtle,
  },
  segment: { minWidth: 4 },
  legend: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  legendText: {
    fontSize: Theme.typography.fontSizeMicro,
    fontWeight: '600',
  },
});

/* ─── Outcome Icon Map ────────────────────────────────────────── */
const outcomeIcon: Record<string, { icon: string; color: string; bg: string }> = {
  done: { icon: '✓', color: Theme.colors.success, bg: Theme.colors.successMuted },
  failed: { icon: '✗', color: Theme.colors.danger, bg: Theme.colors.dangerMuted },
  rejected: { icon: '⊘', color: Theme.colors.danger, bg: Theme.colors.dangerMuted },
  blocked: { icon: '⚠', color: Theme.colors.warning, bg: Theme.colors.warningMuted },
  cancelled: { icon: '◌', color: Theme.colors.warning, bg: Theme.colors.warningMuted },
};

/* ─── Empty State ─────────────────────────────────────────────── */
const EmptyState: React.FC = () => (
  <View style={styles.emptyContainer}>
    <IconCircle icon="📋" color={Theme.colors.textMuted} bgColor={Theme.colors.surfaceElevated} size={72} />
    <Text style={styles.emptyTitle}>No Commands Yet</Text>
    <Text style={styles.emptyDesc}>
      Your command outcomes will appear here after you start using voice commands.
    </Text>
    <Text style={styles.emptyDescSub}>
      የድምጽ ትዕዛዝ ውጤቶች እዚህ ይታያሉ።
    </Text>
  </View>
);

/* ─── History Item Card ───────────────────────────────────────── */
const HistoryItem: React.FC<{ item: CommandOutcome }> = ({ item }) => {
  const iconData = outcomeIcon[item.outcome] || outcomeIcon.cancelled;
  const timeStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <Card style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={styles.itemLeft}>
          <IconCircle icon={iconData.icon} color={iconData.color} bgColor={iconData.bg} size={40} />
          <View style={styles.itemInfo}>
            <StatusBadge status={item.outcome as any} />
            <Text style={styles.timeText}>{dateStr} at {timeStr}</Text>
          </View>
        </View>
        <View style={styles.itemRight}>
          <Text style={styles.durationValue}>{(item.durationMs / 1000).toFixed(1)}s</Text>
          <Text style={styles.durationLabel}>total</Text>
        </View>
      </View>
      <TimingBar timing={item.stageTiming} totalMs={item.durationMs} />
    </Card>
  );
};

/* ─── Main Screen ─────────────────────────────────────────────── */
export const HistoryScreen: React.FC = () => {
  const { state, dispatch } = useAppState();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate a network fetch delay
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // Stats
  const totalCommands = state.commandHistory.length;
  const successCount = state.commandHistory.filter((c) => c.outcome === 'done').length;
  const successRate = totalCommands > 0 ? Math.round((successCount / totalCommands) * 100) : 0;
  const avgDuration =
    totalCommands > 0
      ? Math.round(state.commandHistory.reduce((s, c) => s + c.durationMs, 0) / totalCommands)
      : 0;

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <Text style={styles.header}>Command History</Text>
        <Text style={styles.headerSub}>የትዕዛዝ ታሪክ</Text>
      </View>

      {/* Privacy Banner — always visible */}
      <View style={styles.privacyBanner}>
        <Text style={styles.privacyIcon}>🔒</Text>
        <Text style={styles.privacyText}>
          Privacy: No transcripts or spoken text are stored. Only outcomes and timing data are shown.
        </Text>
      </View>

      {/* Quick Stats */}
      {totalCommands > 0 && (
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{totalCommands}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </Card>
          <Card style={[styles.statCard, { borderColor: Theme.colors.success }]}>
            <Text style={[styles.statValue, { color: Theme.colors.success }]}>{successRate}%</Text>
            <Text style={styles.statLabel}>Success</Text>
          </Card>
          <Card style={[styles.statCard, { borderColor: Theme.colors.info }]}>
            <Text style={[styles.statValue, { color: Theme.colors.info }]}>{(avgDuration / 1000).toFixed(1)}s</Text>
            <Text style={styles.statLabel}>Avg Time</Text>
          </Card>
        </View>
      )}

      {/* Command List */}
      <FlatList
        data={state.commandHistory}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <HistoryItem item={item} />}
        ListEmptyComponent={<EmptyState />}
        contentContainerStyle={totalCommands === 0 ? { flex: 1 } : { paddingBottom: Theme.spacing.xxl }}
        style={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Theme.colors.primary}
            colors={[Theme.colors.primary]}
            progressBackgroundColor={Theme.colors.cardBackground}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  headerSection: {
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
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceElevated,
    marginHorizontal: Theme.spacing.md,
    padding: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.sm,
    marginBottom: Theme.spacing.sm,
  },
  privacyIcon: {
    fontSize: 14,
    marginRight: Theme.spacing.sm,
  },
  privacyText: {
    flex: 1,
    fontSize: Theme.typography.fontSizeMicro,
    color: Theme.colors.textMuted,
    lineHeight: 14,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Theme.spacing.md,
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: Theme.spacing.sm,
  },
  statValue: {
    fontSize: Theme.typography.fontSizeSubheader,
    fontWeight: '800',
    color: Theme.colors.text,
  },
  statLabel: {
    fontSize: Theme.typography.fontSizeMicro,
    color: Theme.colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  list: {
    paddingHorizontal: Theme.spacing.md,
  },
  itemCard: {
    marginBottom: Theme.spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemInfo: {
    marginLeft: Theme.spacing.sm,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: Theme.typography.fontSizeMicro,
    color: Theme.colors.textMuted,
    marginTop: 4,
  },
  durationValue: {
    fontSize: Theme.typography.fontSizeSubheader,
    fontWeight: '800',
    color: Theme.colors.text,
  },
  durationLabel: {
    fontSize: Theme.typography.fontSizeMicro,
    color: Theme.colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: Theme.typography.fontSizeSubheader,
    fontWeight: '700',
    color: Theme.colors.text,
    marginTop: Theme.spacing.md,
  },
  emptyDesc: {
    fontSize: Theme.typography.fontSizeSmall,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    marginTop: Theme.spacing.sm,
    lineHeight: 20,
  },
  emptyDescSub: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    marginTop: Theme.spacing.xs,
    fontStyle: 'italic',
  },
});
