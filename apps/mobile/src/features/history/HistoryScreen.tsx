import React, { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Inbox } from 'lucide-react-native';
import { Theme } from '../../design/theme';
import { Card, EmptyState, StatusBadge, type StatusTone } from '../../design/SharedComponents';
import { useAppState } from '../../state/AppStateContext';
import { type CommandOutcomeCode } from '../../native/VoicePipelineBridge';
import { t, type StringKey } from '../../i18n/strings';

type Filter = 'ALL' | CommandOutcomeCode;

const FILTERS: Filter[] = ['ALL', 'done', 'blocked', 'rejected', 'failed'];

const OUTCOME_KEY: Record<CommandOutcomeCode, StringKey> = {
  done: 'outcomeDone',
  failed: 'outcomeFailed',
  rejected: 'outcomeRejected',
  blocked: 'outcomeBlocked',
  cancelled: 'outcomeCancelled',
};

const OUTCOME_TONE: Record<CommandOutcomeCode, StatusTone> = {
  done: 'positive',
  failed: 'negative',
  rejected: 'neutral',
  blocked: 'negative',
  cancelled: 'neutral',
};

export const HistoryScreen: React.FC = () => {
  const { state } = useAppState();
  const [filter, setFilter] = useState<Filter>('ALL');
  const language = state.selectedLanguage;

  const label = (outcome: CommandOutcomeCode) => t(OUTCOME_KEY[outcome], language);
  const history = state.commandHistory;
  const visible = filter === 'ALL' ? history : history.filter((item) => item.outcome === filter);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {t('historyTitle', language)}
        </Text>
        <Text style={styles.subtitle}>{t('historySubtitle', language)}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        style={styles.filterStrip}
      >
        {FILTERS.map((f) => {
          const chipLabel = f === 'ALL' ? t('filterAll', language) : label(f);
          const isActive = filter === f;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              accessibilityRole="button"
              accessibilityLabel={chipLabel}
              accessibilityState={{ selected: isActive }}
              style={({ pressed }) => [
                styles.chip,
                isActive && styles.chipActive,
                pressed && styles.chipPressed,
              ]}
            >
              <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                {chipLabel}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon={Inbox}
            title={history.length === 0 ? t('historyEmpty', language) : t('emptyFilter', language)}
          />
        }
        renderItem={({ item }) => (
          <Card
            style={styles.row}
            accessible
            accessibilityLabel={`${label(item.outcome)}, ${Math.round(item.durationMs / 100) / 10}s`}
          >
            <View style={styles.rowTop}>
              <StatusBadge tone={OUTCOME_TONE[item.outcome]} label={label(item.outcome)} />
              <Text style={styles.duration}>{(item.durationMs / 1000).toFixed(1)}s</Text>
            </View>
            <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleString()}</Text>
          </Card>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Theme.colors.ground,
  },
  header: {
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.sm,
  },
  title: {
    ...Theme.type.display,
    color: Theme.colors.strong,
  },
  subtitle: {
    ...Theme.type.body,
    color: Theme.colors.muted,
    marginTop: Theme.spacing.xs,
  },
  filterStrip: {
    flexGrow: 0,
    marginTop: Theme.spacing.md,
  },
  filters: {
    paddingHorizontal: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.line,
  },
  chipActive: {
    backgroundColor: Theme.colors.strong,
    borderColor: Theme.colors.strong,
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipLabel: {
    ...Theme.type.label,
    color: Theme.colors.base,
  },
  chipLabelActive: {
    color: Theme.colors.ground,
  },
  list: {
    padding: Theme.spacing.md,
    gap: Theme.spacing.sm,
    flexGrow: 1,
  },
  row: {
    paddingVertical: Theme.spacing.md,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  duration: {
    ...Theme.type.caption,
    color: Theme.colors.muted,
  },
  timestamp: {
    ...Theme.type.caption,
    color: Theme.colors.muted,
    marginTop: Theme.spacing.sm,
  },
});
