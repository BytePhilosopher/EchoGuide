import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Theme } from '../../design/theme';

interface CommandOutcomeItem {
  id: string;
  timestamp: string;
  outcome: 'ACCEPTED' | 'REJECTED' | 'CONFIRMED';
  durationMs: number;
}

const mockHistory: CommandOutcomeItem[] = [
  { id: '1', timestamp: '2026-09-17 14:20:10', outcome: 'ACCEPTED', durationMs: 1420 },
  { id: '2', timestamp: '2026-09-17 14:18:45', outcome: 'CONFIRMED', durationMs: 2350 },
  { id: '3', timestamp: '2026-09-17 14:05:02', outcome: 'REJECTED', durationMs: 650 },
];

export const HistoryScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Command Outcomes</Text>
      <Text style={styles.privacyNote}>🔒 Privacy mode: No transcripts or spoken text are saved.</Text>

      <FlatList
        data={mockHistory}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View>
              <Text style={styles.outcomeText}>Outcome: {item.outcome}</Text>
              <Text style={styles.timeText}>{item.timestamp}</Text>
            </View>
            <Text style={styles.durationText}>{item.durationMs} ms</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    padding: Theme.spacing.md,
  },
  header: {
    fontSize: Theme.typography.fontSizeHeader,
    color: Theme.colors.text,
    fontWeight: 'bold',
  },
  privacyNote: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    marginBottom: Theme.spacing.md,
    marginTop: 4,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Theme.colors.cardBackground,
    padding: Theme.spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: Theme.spacing.sm,
  },
  outcomeText: {
    color: Theme.colors.text,
    fontWeight: '600',
    fontSize: Theme.typography.fontSizeBody,
  },
  timeText: {
    color: Theme.colors.textMuted,
    fontSize: Theme.typography.fontSizeCaption,
  },
  durationText: {
    color: Theme.colors.accent,
    fontWeight: '500',
  },
});
