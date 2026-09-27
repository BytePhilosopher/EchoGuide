import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Mic, MicOff, ShieldAlert, Volume2 } from 'lucide-react-native';
import { Theme } from '../../design/theme';
import { Card, PrimaryButton, SectionHeader } from '../../design/SharedComponents';
import { useAppState } from '../../state/AppStateContext';
import { VoicePipelineBridge } from '../../native/VoicePipelineBridge';
import { usePipelineState } from '../../native/usePipelineState';
import { t, type Locale, type StringKey } from '../../i18n/strings';
import { AccessibilitySetupGuide } from '../accessibility/AccessibilitySetupGuide';

const EXAMPLES: { say: StringKey; tip: StringKey }[] = [
  { say: 'exampleOpenApp', tip: 'tipOpenApp' },
  { say: 'exampleTap', tip: 'tipTap' },
  { say: 'exampleScroll', tip: 'tipScroll' },
];

const ModelSetupCard: React.FC<{ progress: number; language: Locale }> = ({ progress, language }) => {
  const percent = Math.round(progress * 100);
  return (
    <Card style={styles.setupCard}>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${t('modelSetupTitle', language)}. ${t('modelSetupBody', language)}`}
        accessibilityValue={{ min: 0, max: 100, now: percent }}
      >
        <View style={styles.progressHeader}>
          <Text style={styles.setupTitle}>{t('modelSetupTitle', language)}</Text>
          <Text style={styles.progressPercent}>{percent}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${percent}%` }]} />
        </View>
        <Text style={[styles.setupBody, styles.progressBody]}>{t('modelSetupBody', language)}</Text>
      </View>
    </Card>
  );
};

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

  const toggleListening = async () => {
    Haptics.impactAsync(
      isListening ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
    ).catch(() => undefined);
    if (isListening) {
      VoicePipelineBridge.stopListening();
      return;
    }
    if (!(await VoicePipelineBridge.requestMicrophone())) return;
    if (pipeline.wakeWordAvailable) VoicePipelineBridge.startListening();
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

      {pipeline.modelProgress !== null ? (
        <ModelSetupCard progress={pipeline.modelProgress} language={language} />
      ) : null}

      {pipeline.available && !pipeline.microphoneGranted ? (
        <Card style={styles.setupCard}>
          <View style={styles.setupRow}>
            <MicOff size={20} color={Theme.colors.accent} strokeWidth={1.75} />
            <View style={styles.setupCopy}>
              <Text style={styles.setupTitle}>{t('micTitle', language)}</Text>
              <Text style={styles.setupBody}>{t('micBody', language)}</Text>
            </View>
          </View>
          <PrimaryButton
            title={t('openAppSettings', language)}
            onPress={() => Linking.openSettings()}
            style={styles.setupButton}
          />
        </Card>
      ) : null}

      {needsSetup ? (
        <Card style={styles.setupCard}>
          <View style={styles.setupRow}>
            <ShieldAlert size={20} color={Theme.colors.accent} strokeWidth={1.75} />
            <Text style={styles.setupText}>{t('enableInSettings', language)}</Text>
          </View>
          <View style={styles.guide}>
            <AccessibilitySetupGuide language={language} />
          </View>
        </Card>
      ) : null}

      {pipeline.available && !pipeline.hasVoice ? (
        <Card style={styles.setupCard}>
          <View style={styles.setupRow}>
            <Volume2 size={20} color={Theme.colors.accent} strokeWidth={1.75} />
            <View style={styles.setupCopy}>
              <Text style={styles.setupTitle}>{t('voiceMissingTitle', language)}</Text>
              <Text style={styles.setupBody}>{t('voiceMissingBody', language)}</Text>
            </View>
          </View>
          <PrimaryButton
            title={t('openVoiceSettings', language)}
            onPress={() => VoicePipelineBridge.openVoiceSettings()}
            variant="secondary"
            accessibilityHint={t('openVoiceSettingsHint', language)}
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
        <Text style={styles.howTo}>{t('howToUse', language)}</Text>
        {EXAMPLES.map(({ say, tip }) => (
          <View key={say} style={styles.exampleItem}>
            <Text style={styles.example}>“{state.wakeWord}, {t(say, language)}”</Text>
            <Text style={styles.exampleHint}>{t(tip, language)}</Text>
          </View>
        ))}
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
  setupCopy: {
    flex: 1,
    marginLeft: Theme.spacing.sm,
  },
  setupBody: {
    ...Theme.type.body,
    color: Theme.colors.base,
  },
  setupTitle: {
    ...Theme.type.bodyStrong,
    color: Theme.colors.strong,
    marginBottom: 2,
  },
  guide: {
    marginTop: Theme.spacing.lg,
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
  howTo: {
    ...Theme.type.body,
    color: Theme.colors.base,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  progressPercent: {
    ...Theme.type.label,
    color: Theme.colors.accent,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 6,
    borderRadius: Theme.radius.pill,
    backgroundColor: Theme.colors.line,
    overflow: 'hidden',
    marginTop: Theme.spacing.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Theme.colors.accent,
  },
  progressBody: {
    marginTop: Theme.spacing.sm,
  },
  exampleItem: {
    marginTop: Theme.spacing.md,
  },
});
