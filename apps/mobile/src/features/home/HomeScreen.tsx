import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Theme } from '../../design/theme';
import { Card, IconCircle, StatusBadge, Divider, PrimaryButton } from '../../design/SharedComponents';
import { useAppState } from '../../state/AppStateContext';
import { VoicePipelineBridge } from '../../native/VoicePipelineBridge';

export const HomeScreen: React.FC = () => {
  const { state, dispatch } = useAppState();
  const [isListening, setIsListening] = useState<boolean>(true);

  // Today's stats
  const today = new Date().toDateString();
  const todayCommands = state.commandHistory.filter(
    (c) => new Date(c.timestamp).toDateString() === today
  );
  const todaySuccess = todayCommands.filter((c) => c.outcome === 'done').length;
  const todayRate = todayCommands.length > 0 ? Math.round((todaySuccess / todayCommands.length) * 100) : 100;

  const toggleListening = () => {
    if (isListening) {
      VoicePipelineBridge.stopListening();
      setIsListening(false);
    } else {
      VoicePipelineBridge.startListening();
      setIsListening(true);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ─── Header Section ────────────────────────────────────── */}
      <View style={styles.headerSection}>
        <View style={styles.greetingRow}>
          <Text style={styles.greeting}>
            {state.selectedLanguage === 'am-ET' ? 'ሰላም 👋' : 'Hello 👋'}
          </Text>
          <View style={styles.liveTag}>
            <View style={[styles.liveDot, { backgroundColor: isListening ? Theme.colors.success : Theme.colors.danger }]} />
            <Text style={styles.liveText}>{isListening ? 'ENGINE LIVE' : 'PAUSED'}</Text>
          </View>
        </View>

        <Text style={styles.headerTitle}>EchoGuide</Text>
        <Text style={styles.headerSub}>
          {state.selectedLanguage === 'am-ET'
            ? 'ተደራሽነት ድምጽ ረዳት • 16 kHz PCM §5.1'
            : 'Bilingual Voice Control • 16 kHz PCM §5.1'}
        </Text>
      </View>

      {/* ─── Listening Pulsing Hero Card ──────────────────────── */}
      <Card elevated style={styles.heroCard}>
        <View style={styles.heroInner}>
          <View style={[styles.pulseCircleOuter, isListening && styles.pulseGlow]}>
            <View style={[styles.pulseCircleMid, isListening && { backgroundColor: 'rgba(0, 229, 255, 0.2)' }]}>
              <TouchableOpacity
                onPress={toggleListening}
                activeOpacity={0.8}
                style={[styles.pulseCircleInner, { backgroundColor: isListening ? Theme.colors.primary : Theme.colors.surfaceElevated }]}
              >
                <Text style={{ fontSize: 32 }}>{isListening ? '🎙️' : '🔇'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.heroStatusTitle}>
            {isListening ? `Say "${state.wakeWord}"` : 'Voice Engine Paused'}
          </Text>
          <Text style={styles.heroStatusSub}>
            {isListening
              ? state.selectedLanguage === 'am-ET'
                ? 'የድምፅ ረዳቱ ትእዛዝዎን ለመስማት ዝግጁ ነው'
                : 'Wake-word detection running natively in Kotlin'
              : 'Tap microphone icon to resume voice detection'}
          </Text>

          <View style={styles.heroActionContainer}>
            <PrimaryButton
              title={isListening ? 'Pause Listening' : 'Start Voice Engine'}
              onPress={toggleListening}
              variant={isListening ? 'ghost' : 'glow'}
              icon={isListening ? '⏸️' : '▶️'}
              style={{ minWidth: 200 }}
            />
          </View>
        </View>
      </Card>

      {/* ─── Quick Stats Dashboard ────────────────────────────── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>PIPELINE PERFORMANCE</Text>
        <Text style={styles.sectionSub}>Real-time telemetry</Text>
      </View>

      <View style={styles.statsRow}>
        <Card style={styles.miniStat}>
          <Text style={styles.miniStatIcon}>⚡</Text>
          <Text style={styles.miniStatValue}>{todayCommands.length}</Text>
          <Text style={styles.miniStatLabel}>Commands</Text>
        </Card>
        <Card style={[styles.miniStat, { borderColor: Theme.colors.successMuted }]}>
          <Text style={styles.miniStatIcon}>🎯</Text>
          <Text style={[styles.miniStatValue, { color: Theme.colors.success }]}>{todayRate}%</Text>
          <Text style={styles.miniStatLabel}>Success</Text>
        </Card>
        <Card style={[styles.miniStat, { borderColor: Theme.colors.accentMuted }]}>
          <Text style={styles.miniStatIcon}>⏱️</Text>
          <Text style={[styles.miniStatValue, { color: Theme.colors.accent }]}>~450ms</Text>
          <Text style={styles.miniStatLabel}>Avg Latency</Text>
        </Card>
      </View>

      {/* ─── Config Summary Card ──────────────────────────────── */}
      <Card style={styles.configCard}>
        <View style={styles.configRow}>
          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Language</Text>
            <Text style={styles.configValue}>
              {state.selectedLanguage === 'am-ET' ? '🇪🇹 አማርኛ' : '🇺🇸 English'}
            </Text>
          </View>

          <View style={[styles.configItem, styles.configBorder]}>
            <Text style={styles.configLabel}>Wake Word</Text>
            <Text style={[styles.configValue, { color: Theme.colors.primary }]}>"{state.wakeWord}"</Text>
          </View>

          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Consent</Text>
            <StatusBadge
              status={state.consentGranted ? 'active' : 'inactive'}
              label={state.consentGranted ? 'Granted' : 'Needed'}
            />
          </View>
        </View>
      </Card>

      {/* ─── Quick Voice Commands ─────────────────────────────── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>RECOMMENDED COMMANDS</Text>
        <Text style={styles.sectionSub}>Bilingual shortcuts</Text>
      </View>

      <Card style={{ marginBottom: Theme.spacing.xxl }}>
        <View style={styles.tipRow}>
          <View style={styles.tipBadge}>
            <Text style={styles.tipBadgeText}>AM</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tipTitle}>"Echo, መልእክት ላክ"</Text>
            <Text style={styles.tipDesc}>Opens messaging & drafts dictation</Text>
          </View>
        </View>

        <Divider spacing={Theme.spacing.xs} />

        <View style={styles.tipRow}>
          <View style={[styles.tipBadge, { backgroundColor: Theme.colors.secondaryMuted, borderColor: Theme.colors.secondary }]}>
            <Text style={[styles.tipBadgeText, { color: Theme.colors.secondary }]}>EN</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tipTitle}>"Echo, open phone settings"</Text>
            <Text style={styles.tipDesc}>Navigates directly to System Settings</Text>
          </View>
        </View>

        <Divider spacing={Theme.spacing.xs} />

        <View style={styles.tipRow}>
          <View style={styles.tipBadge}>
            <Text style={styles.tipBadgeText}>AM</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tipTitle}>"Echo, ጥሪ አድርግ"</Text>
            <Text style={styles.tipDesc}>Initiates voice-guided contact phone call</Text>
          </View>
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
    paddingTop: Theme.spacing.lg,
  },
  headerSection: {
    marginBottom: Theme.spacing.md,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  greeting: {
    fontSize: Theme.typography.fontSizeSmall,
    color: Theme.colors.textMuted,
    fontWeight: '600',
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  liveText: {
    fontSize: Theme.typography.fontSizeMicro,
    fontWeight: '800',
    color: Theme.colors.textSecondary,
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: Theme.typography.fontSizeDisplay,
    fontWeight: '900',
    color: Theme.colors.text,
    letterSpacing: -0.8,
  },
  headerSub: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  heroCard: {
    marginBottom: Theme.spacing.lg,
    backgroundColor: Theme.colors.cardBackground,
    borderColor: Theme.colors.border,
    paddingVertical: Theme.spacing.lg,
  },
  heroInner: {
    alignItems: 'center',
  },
  pulseCircleOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.md,
  },
  pulseGlow: {
    borderWidth: 1,
    borderColor: Theme.colors.primaryMuted,
    ...Theme.shadow.glow,
  },
  pulseCircleMid: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseCircleInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadow.card,
  },
  heroStatusTitle: {
    fontSize: Theme.typography.fontSizeHeader,
    fontWeight: '800',
    color: Theme.colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  heroStatusSub: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    lineHeight: 18,
  },
  heroActionContainer: {
    alignItems: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.xs,
    marginTop: Theme.spacing.xs,
  },
  sectionTitle: {
    fontSize: Theme.typography.fontSizeCaption,
    fontWeight: '800',
    color: Theme.colors.primary,
    letterSpacing: 1.5,
  },
  sectionSub: {
    fontSize: Theme.typography.fontSizeMicro,
    color: Theme.colors.textMuted,
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
    backgroundColor: Theme.colors.cardBackground,
  },
  miniStatIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  miniStatValue: {
    fontSize: Theme.typography.fontSizeHeader,
    fontWeight: '900',
    color: Theme.colors.text,
  },
  miniStatLabel: {
    fontSize: Theme.typography.fontSizeMicro,
    color: Theme.colors.textMuted,
    fontWeight: '700',
    marginTop: 2,
  },
  configCard: {
    marginBottom: Theme.spacing.lg,
    backgroundColor: Theme.colors.surfaceElevated,
    padding: Theme.spacing.sm,
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  configItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Theme.spacing.xs,
  },
  configBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Theme.colors.border,
  },
  configLabel: {
    fontSize: Theme.typography.fontSizeMicro,
    color: Theme.colors.textMuted,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  configValue: {
    fontSize: Theme.typography.fontSizeSmall,
    color: Theme.colors.text,
    fontWeight: '700',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Theme.spacing.xs,
  },
  tipBadge: {
    backgroundColor: Theme.colors.primaryMuted,
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.xs,
    marginRight: Theme.spacing.md,
  },
  tipBadgeText: {
    fontSize: Theme.typography.fontSizeMicro,
    fontWeight: '900',
    color: Theme.colors.primary,
  },
  tipTitle: {
    fontSize: Theme.typography.fontSizeSmall,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  tipDesc: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
});
