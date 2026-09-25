import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Mic, MicOff, ShieldAlert } from 'lucide-react-native';
import { Theme } from '../../design/theme';
import { Card, PrimaryButton, SectionHeader } from '../../design/SharedComponents';
import { useAppState } from '../../state/AppStateContext';
import { VoicePipelineBridge } from '../../native/VoicePipelineBridge';
import { usePipelineState } from '../../native/usePipelineState';
import { t } from '../../i18n/strings';

export const HomeScreen: React.FC = () => {
  const { state } = useAppState();
  const pipeline = usePipelineState();
  const language = state.selectedLanguage;
  const isListening = pipeline.isListening;

  const today = new Date().toDateString();
  const todayCommands = state.commandHistory.filter(
    (c) => new Date(c.timestamp).toDateString() === today,
  );
  const todaySuccess = todayCommands.filter((c) => c.outcome === 'done').length;

  const statusLabel = !pipeline.available
    ? t('engineUnavailable', language)
    : isListening
      ? t('engineListening', language)
      : t('enginePaused', language);

  const toggleListening = () => {
    Haptics.impactAsync(
      isListening ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
    ).catch(() => undefined);
    if (isListening) VoicePipelineBridge.stopListening();
    else if (pipeline.wakeWordAvailable) VoicePipelineBridge.startListening();
    else VoicePipelineBridge.triggerListening();
  };

  const needsSetup = pipeline.available && !pipeline.accessibilityEnabled;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.greeting}>
        {language === 'am-ET' ? 'ሰላም' : 'Hello'}
      </Text>

      <Pressable
        onPress={toggleListening}
        disabled={!pipeline.available}
        accessibilityRole="button"
        accessibilityLabel={statusLabel}
        accessibilityHint={
          isListening ? t('stopListening', language) : t('startListening', language)
        }
        accessibilityState={{ selected: isListening, disabled: !pipeline.available }}
        style={({ pressed }) => [
          styles.mic,
          isListening ? styles.micOn : styles.micOff,
          pressed && styles.micPressed,
          !pipeline.available && styles.micUnavailable,
        ]}
      >
        {isListening ? (
          <Mic size={44} color={Theme.colors.accentInk} strokeWidth={1.75} />
        ) : (
          <MicOff size={44} color={Theme.colors.base} strokeWidth={1.75} />
        )}
      </Pressable>

      <View accessibilityLiveRegion="polite" style={styles.statusBlock}>
        <Text style={styles.statusTitle}>
          {!isListening
            ? t('paused', language)
            : pipeline.wakeWordAvailable
              ? `“${state.wakeWord}”`
              : t('listening', language)}
        </Text>
        <Text style={styles.statusBody}>
          {!pipeline.available
            ? t('engineUnavailable', language)
            : needsSetup
              ? t('enableInSettings', language)
              : !isListening
                ? t('tapToStart', language)
                : pipeline.wakeWordAvailable
                  ? t('sayWakeThenCommand', language)
                  : t('tapEachTime', language)}
        </Text>
      </View>

      {needsSetup ? (
        <Card style={styles.setupCard}>
          <View style={styles.setupRow}>
            <ShieldAlert size={20} color={Theme.colors.accent} strokeWidth={1.75} />
            <Text style={styles.setupText}>{t('enableInSettings', language)}</Text>
          </View>
          <PrimaryButton
            title={t('openAccessibility', language)}
            onPress={() => VoicePipelineBridge.openAccessibilitySettings()}
            accessibilityHint={t('openAccessibilityHint', language)}
            style={styles.setupButton}
          />
        </Card>
      ) : null}

      {todayCommands.length > 0 ? (
        <>
          <SectionHeader title={t('sectionPerformance', language)} />
          <Card
            accessible
            accessibilityLabel={`${todayCommands.length} ${t('commands', language)}, ${todaySuccess} ${t('success', language)}`}
          >
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{todayCommands.length}</Text>
                <Text style={styles.statLabel}>{t('commands', language)}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{todaySuccess}</Text>
                <Text style={styles.statLabel}>{t('success', language)}</Text>
              </View>
            </View>
          </Card>
        </>
      ) : null}

      <SectionHeader title={t('sectionTryThese', language)} />
      <Card>
        <Text style={styles.example}>“{state.wakeWord}, መልእክት ላክ”</Text>
        <Text style={styles.exampleHint}>{t('tipSendMessage', language)}</Text>
        <View style={styles.exampleGap} />
        <Text style={styles.example}>“{state.wakeWord}, open settings”</Text>
        <Text style={styles.exampleHint}>{t('tipOpenSettings', language)}</Text>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Theme.colors.ground,
  },
  content: {
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: Theme.spacing.xxl,
    paddingTop: Theme.spacing.sm,
  },
  greeting: {
    ...Theme.type.display,
    color: Theme.colors.strong,
    marginBottom: Theme.spacing.xl,
  },
  mic: {
    alignSelf: 'center',
    width: 168,
    height: 168,
    borderRadius: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  micOn: {
    backgroundColor: Theme.colors.accent,
    borderColor: Theme.colors.accent,
  },
  micOff: {
    backgroundColor: Theme.colors.raised,
    borderColor: Theme.colors.lineStrong,
  },
  micPressed: {
    opacity: 0.75,
  },
  micUnavailable: {
    opacity: 0.4,
  },
  statusBlock: {
    alignItems: 'center',
    marginTop: Theme.spacing.lg,
    marginBottom: Theme.spacing.lg,
  },
  statusTitle: {
    ...Theme.type.title,
    color: Theme.colors.strong,
    textAlign: 'center',
  },
  statusBody: {
    ...Theme.type.body,
    color: Theme.colors.base,
    textAlign: 'center',
    marginTop: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.md,
  },
  setupCard: {
    borderColor: 'rgba(224,182,74,0.35)',
  },
  setupRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  setupText: {
    ...Theme.type.body,
    color: Theme.colors.base,
    flex: 1,
    marginLeft: Theme.spacing.sm,
  },
  setupButton: {
    marginTop: Theme.spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: Theme.colors.line,
  },
  statValue: {
    ...Theme.type.display,
    color: Theme.colors.strong,
  },
  statLabel: {
    ...Theme.type.caption,
    color: Theme.colors.muted,
    marginTop: 2,
  },
  example: {
    ...Theme.type.bodyStrong,
    color: Theme.colors.strong,
  },
  exampleHint: {
    ...Theme.type.caption,
    color: Theme.colors.muted,
    marginTop: 2,
  },
  exampleGap: {
    height: Theme.spacing.md,
  },
});
