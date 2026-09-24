import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Theme } from '../../design/theme';
import { Card, StatusBadge, Divider } from '../../design/SharedComponents';
import { VoicePipelineBridge, CommandOutcomeEvent } from '../../native/VoicePipelineBridge';

const mockInitialHistory: CommandOutcomeEvent[] = [
  { id: '1', timestamp: '2026-09-24 20:14:10', outcome: 'ACCEPTED', durationMs: 1420 },
  { id: '2', timestamp: '2026-09-24 19:48:45', outcome: 'CONFIRMED', durationMs: 2350 },
  { id: '3', timestamp: '2026-09-24 18:05:02', outcome: 'REJECTED', durationMs: 650 },
  { id: '4', timestamp: '2026-09-24 16:22:18', outcome: 'ACCEPTED', durationMs: 1100 },
];

export const HistoryScreen: React.FC = () => {
  const [history, setHistory] = useState<CommandOutcomeEvent[]>(mockInitialHistory);
  const [filter, setFilter] = useState<'ALL' | 'ACCEPTED' | 'CONFIRMED' | 'REJECTED'>('ALL');

  useEffect(() => {
    const unsubscribe = VoicePipelineBridge.subscribeToOutcomes((event) => {
      setHistory((prev) => [event, ...prev]);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const filteredHistory = history.filter((item) => {
    if (filter === 'ALL') return true;
    return item.outcome === filter;
  });

  const renderBadge = (outcome: CommandOutcomeEvent['outcome']) => {
    switch (outcome) {
      case 'ACCEPTED':
        return <StatusBadge status="done" label="✓ ACCEPTED" />;
      case 'CONFIRMED':
        return <StatusBadge status="confirmed" label="🛡️ CONFIRMED" />;
      case 'REJECTED':
        return <StatusBadge status="rejected" label="✕ REJECTED" />;
    }
  };

  return (
    <View style={styles.container} accessibilityLabel="Command Outcome History Screen">
      {/* Header */}
      <View style={styles.headerBox}>
        <Text style={styles.header} accessibilityRole="header">
          Command Outcomes
        </Text>
        <Text style={styles.subHeader}>
          Real-time execution log from native voice bridge (§5.4)
        </Text>

        <Card style={styles.privacyNoteCard}>
          <View style={styles.privacyNoteRow}>
            <Text style={{ fontSize: 18, marginRight: 8 }}>🔒</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.privacyTitle}>Zero-Persistence Privacy (§9.1)</Text>
              <Text style={styles.privacyDesc}>
                No spoken transcripts or raw audio recordings are stored locally or transmitted.
              </Text>
            </View>
          </View>
        </Card>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {(['ALL', 'ACCEPTED', 'CONFIRMED', 'REJECTED'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* History List */}
      <FlatList
        data={filteredHistory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Card style={styles.itemCard}>
            <View style={styles.cardHeader}>
              {renderBadge(item.outcome)}
              <Text style={styles.durationText}>{item.durationMs}ms</Text>
            </View>

            <Divider spacing={Theme.spacing.xs} />

            <View style={styles.cardFooter}>
              <Text style={styles.metaText}>📅 {item.timestamp}</Text>
              <Text style={styles.latencyLabel}>Pipeline Latency</Text>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📭</Text>
            <Text style={styles.emptyText}>No outcomes match the selected filter</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Theme.spacing.md,
    backgroundColor: Theme.colors.background,
  },
  headerBox: {
    marginBottom: Theme.spacing.sm,
  },
  header: {
    fontSize: Theme.typography.fontSizeHero,
    fontWeight: '900',
    color: Theme.colors.text,
    letterSpacing: -0.5,
  },
  subHeader: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    marginTop: 2,
    marginBottom: Theme.spacing.md,
  },
  privacyNoteCard: {
    backgroundColor: Theme.colors.surfaceElevated,
    borderColor: Theme.colors.border,
    padding: Theme.spacing.sm,
  },
  privacyNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  privacyTitle: {
    fontSize: Theme.typography.fontSizeSmall,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  privacyDesc: {
    fontSize: Theme.typography.fontSizeMicro,
    color: Theme.colors.textMuted,
    marginTop: 2,
    lineHeight: 15,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Theme.spacing.md,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: Theme.colors.primaryMuted,
    borderColor: Theme.colors.primary,
  },
  filterChipText: {
    fontSize: Theme.typography.fontSizeMicro,
    color: Theme.colors.textMuted,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: Theme.colors.primary,
  },
  listContent: {
    paddingBottom: Theme.spacing.xxl,
  },
  itemCard: {
    marginBottom: Theme.spacing.sm,
    backgroundColor: Theme.colors.cardBackground,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  durationText: {
    fontSize: Theme.typography.fontSizeBody,
    fontWeight: '900',
    color: Theme.colors.primary,
  },
  metaText: {
    fontSize: Theme.typography.fontSizeMicro,
    color: Theme.colors.textMuted,
  },
  latencyLabel: {
    fontSize: Theme.typography.fontSizeMicro,
    color: Theme.colors.textMuted,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xxl,
  },
  emptyText: {
    fontSize: Theme.typography.fontSizeSmall,
    color: Theme.colors.textMuted,
  },
});
