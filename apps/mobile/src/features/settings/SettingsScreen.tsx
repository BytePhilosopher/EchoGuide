import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Theme } from '../../design/theme';
import { Card, SectionHeader, Divider, PrimaryButton } from '../../design/SharedComponents';
import { VoicePipelineBridge } from '../../native/VoicePipelineBridge';

export const SettingsScreen: React.FC = () => {
  const [dataRetention, setDataRetention] = useState<boolean>(false);
  const [selectedLanguage, setSelectedLanguage] = useState<'am-ET' | 'en-US'>('am-ET');
  const [wakeWordActive, setWakeWordActive] = useState<boolean>(true);
  const [isRevoking, setIsRevoking] = useState<boolean>(false);

  useEffect(() => {
    VoicePipelineBridge.getServiceState().then((state) => {
      setSelectedLanguage(state.currentLanguage);
      setWakeWordActive(state.isWakeWordActive);
    });
  }, []);

  const handleLanguageChange = async (lang: 'am-ET' | 'en-US') => {
    setSelectedLanguage(lang);
    await VoicePipelineBridge.setLanguage(lang);
  };

  const handleRevokeConsent = () => {
    Alert.alert(
      'Revoke Voice Consent / ፈቃድ ሰርዝ',
      'Are you sure you want to revoke voice processing consent? The assistant will stop listening immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke Consent',
          style: 'destructive',
          onPress: async () => {
            setIsRevoking(true);
            await VoicePipelineBridge.revokeConsent();
            setIsRevoking(false);
            Alert.alert('Consent Revoked', 'Voice data processing consent has been revoked.');
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      accessibilityLabel="Accessibility Settings Screen"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.header} accessibilityRole="header">
        Accessibility Settings
      </Text>
      <Text style={styles.headerSubtitle}>
        Configure voice engine, retention policies, and permissions (§5.3)
      </Text>

      {/* Language Segmented Card */}
      <SectionHeader title="VOICE ENGINE LANGUAGE" badge="BILINGUAL §1" />
      <Card style={styles.card}>
        <Text style={styles.cardSubtext}>
          Select speech recognition and text-to-speech model provider
        </Text>

        <View style={styles.rowBtnContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, selectedLanguage === 'am-ET' && styles.segmentBtnActive]}
            onPress={() => handleLanguageChange('am-ET')}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 20, marginBottom: 4 }}>🇪🇹</Text>
            <Text style={[styles.segmentText, selectedLanguage === 'am-ET' && styles.segmentTextActive]}>
              አማርኛ (Amharic)
            </Text>
            <Text style={styles.segmentSub}>Addis AI Cloud STT</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, selectedLanguage === 'en-US' && styles.segmentBtnActive]}
            onPress={() => handleLanguageChange('en-US')}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 20, marginBottom: 4 }}>🇺🇸</Text>
            <Text style={[styles.segmentText, selectedLanguage === 'en-US' && styles.segmentTextActive]}>
              English (US)
            </Text>
            <Text style={styles.segmentSub}>Android On-Device TTS</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Voice Controls */}
      <SectionHeader title="VOICE CONTROLS" badge="ALWAYS-ON §6.1" />
      <Card style={styles.card}>
        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.label}>Always-On Wake-Word (§6.1)</Text>
            <Text style={styles.subtext}>
              Kotlin background service monitors wake-word without requiring active app window.
            </Text>
          </View>
          <Switch
            value={wakeWordActive}
            onValueChange={(val) => {
              setWakeWordActive(val);
              if (val) {
                VoicePipelineBridge.startListening();
              } else {
                VoicePipelineBridge.stopListening();
              }
            }}
            trackColor={{ false: Theme.colors.border, true: Theme.colors.primary }}
            thumbColor={wakeWordActive ? '#FFFFFF' : Theme.colors.textMuted}
          />
        </View>

        <Divider spacing={Theme.spacing.sm} />

        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.label}>Opt-In Audio Retention (§4D)</Text>
            <Text style={styles.subtext}>
              Default path persists zero audio. Enable only if you wish to help improve Amharic AI models.
            </Text>
          </View>
          <Switch
            value={dataRetention}
            onValueChange={setDataRetention}
            trackColor={{ false: Theme.colors.border, true: Theme.colors.primary }}
            thumbColor={dataRetention ? '#FFFFFF' : Theme.colors.textMuted}
          />
        </View>
      </Card>

      {/* Security & Data Revocation */}
      <SectionHeader title="PRIVACY & REVOCATION" badge="GDPR §9.3" />
      <Card style={styles.card}>
        <Text style={styles.label}>Consent & Security Revocation</Text>
        <Text style={styles.subtext}>
          Revoking consent immediately halts native audio capture, clears cached tokens, and logs a cryptographic revocation event to backend telemetry.
        </Text>

        <View style={{ marginTop: Theme.spacing.md }}>
          <PrimaryButton
            title={isRevoking ? 'Revoking Consent...' : 'Revoke Voice Processing Consent'}
            onPress={handleRevokeConsent}
            variant="danger"
            icon="⚠️"
            disabled={isRevoking}
          />
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
  contentContainer: {
    padding: Theme.spacing.md,
    paddingBottom: Theme.spacing.xxl,
  },
  header: {
    fontSize: Theme.typography.fontSizeHero,
    fontWeight: '900',
    color: Theme.colors.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    marginBottom: Theme.spacing.xs,
  },
  card: {
    backgroundColor: Theme.colors.cardBackground,
    marginBottom: Theme.spacing.md,
  },
  cardSubtext: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    marginBottom: Theme.spacing.md,
  },
  rowBtnContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceElevated,
  },
  segmentBtnActive: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.primaryMuted,
    ...Theme.shadow.glow,
  },
  segmentText: {
    fontSize: Theme.typography.fontSizeSmall,
    fontWeight: '700',
    color: Theme.colors.textMuted,
  },
  segmentTextActive: {
    color: Theme.colors.primary,
    fontWeight: '800',
  },
  segmentSub: {
    fontSize: Theme.typography.fontSizeMicro,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: Theme.typography.fontSizeBody,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 4,
  },
  subtext: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    lineHeight: 18,
  },
});
