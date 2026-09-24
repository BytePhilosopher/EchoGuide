import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Theme } from '../../design/theme';
import { VoicePipelineBridge, CommandOutcomeEvent } from '../../native/VoicePipelineBridge';

const mockInitialHistory: CommandOutcomeEvent[] = [
  { id: '1', timestamp: '2026-09-24 20:14:10', outcome: 'ACCEPTED', durationMs: 1420 },
  { id: '2', timestamp: '2026-09-24 19:48:45', outcome: 'CONFIRMED', durationMs: 2350 },
  { id: '3', timestamp: '2026-09-24 18:05:02', outcome: 'REJECTED', durationMs: 650 },
];

export const HistoryScreen: React.FC = () => {
  const [history, setHistory] = useState<CommandOutcomeEvent[]>(mockInitialHistory);

  useEffect(() => {
    // Subscribe to live pipeline outcomes via TurboModule (§5.4)
    // Rule §5.4: Events drop (never queue) when no UI is listening
    const unsubscribe = VoicePipelineBridge.subscribeToOutcomes((event) => {
      setHistory((prev) => [event, ...prev]);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const renderBadge = (outcome: CommandOutcomeEvent['outcome']) => {
    switch (outcome) {
      case 'ACCEPTED':
        return (
          <View style={[styles.badge, { backgroundColor: 'rgba(35, 134, 54, 0.2)', borderColor: Theme.colors.primary }]}>
            <Text style={[styles.badgeText, { color: Theme.colors.primaryHover }]}>✓ ACCEPTED</Text>
          </View>
        );
      case 'CONFIRMED':
        return (
          <View style={[styles.badge, { backgroundColor: 'rgba(31, 111, 235, 0.2)', borderColor: Theme.colors.secondary }]}>
            <Text style={[styles.badgeText, { color: Theme.colors.secondary }]}>🛡️ CONFIRMED</Text>
          </View>
        );
      case 'REJECTED':
        return (
          <View style={[styles.badge, { backgroundColor: 'rgba(248, 81, 73, 0.2)', borderColor: Theme.colors.danger }]}>
            <Text style={[styles.badgeText, { color: Theme.colors.danger }]}>✕ REJECTED</Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.container} accessibilityLabel="Command Outcome History Screen">
      <View style={styles.headerBox}>
        <Text style={styles.header} accessibilityRole="header">
          Command Outcomes
        </Text>
        <Text style={styles.privacyNote} accessibilityRole="summary">
          🔒 Privacy Mode Active (§9.1): Zero spoken transcripts or audio files are persisted or transmitted across the bridge.
        </Text>
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        accessibilityLabel="List of Past Command Outcomes"
        renderItem={({ item }) => (
          <View
            style={styles.itemCard}
            accessibilityLabel={`Command outcome ${item.outcome}, duration ${item.durationMs} milliseconds, executed at ${item.timestamp}`}
          >
            <View style={styles.leftCol}>
              {renderBadge(item.outcome)}
              <Text style={styles.metaText}>{item.timestamp}</Text>
            </View>
            <View style={styles.rightCol}>
              <Text style={styles.durationText}>{item.durationMs}ms</Text>
              <Text style={styles.latencyLabel}>pipeline latency</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: Theme.colors.background,
  },
  headerBox: {
    marginBottom: 16,
  },
  header: {
    fontSize: 26,
    fontWeight: 'bold',
    color: Theme.colors.text,
    marginBottom: 6,
  },
  privacyNote: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    lineHeight: 18,
    backgroundColor: Theme.colors.cardBackground,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  listContent: {
    paddingBottom: 24,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Theme.colors.cardBackground,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: 12,
  },
  leftCol: {
    flex: 1,
  },
  rightCol: {
    alignItems: 'flex-end',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  metaText: {
    fontSize: 12,
    color: Theme.colors.textMuted,
  },
  durationText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Theme.colors.text,
  },
  latencyLabel: {
    fontSize: 10,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
});
