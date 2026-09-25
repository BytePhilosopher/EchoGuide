import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { Theme } from '../../design/theme';
import { Card, PrimaryButton, StatusBadge } from '../../design/SharedComponents';
import { VoicePipelineBridge, ServiceState } from '../../native/VoicePipelineBridge';

interface OnboardingScreenProps {
  onComplete?: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [selectedLang, setSelectedLang] = useState<'am-ET' | 'en-US'>('am-ET');
  const [consentGranted, setConsentGranted] = useState<boolean>(true);
  const [serviceState, setServiceState] = useState<ServiceState>({
    isWakeWordActive: false,
    isAccessibilityEnabled: false,
    currentLanguage: 'am-ET',
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    VoicePipelineBridge.getServiceState().then(setServiceState);
  }, []);

  const handleLanguageSelect = async (lang: 'am-ET' | 'en-US') => {
    setSelectedLang(lang);
    await VoicePipelineBridge.setLanguage(lang);
  };

  const handleFinishOnboarding = async () => {
    if (!consentGranted) {
      Alert.alert(
        'Consent Required / ፈቃድ ያስፈልጋል',
        'EchoGuide requires consent to process voice commands for accessibility automation.'
      );
      return;
    }

    setIsSubmitting(true);
    await VoicePipelineBridge.setLanguage(selectedLang);
    setIsSubmitting(false);

    if (onComplete) {
      onComplete();
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      accessibilityLabel="Onboarding Setup Screen"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerBox}>
        <View style={styles.badgeRow}>
          <View style={styles.logoBadge}>
            <Text style={{ fontSize: 24 }}>🎙️</Text>
          </View>
        </View>
        <Text style={styles.title} accessibilityRole="header">
          Welcome to EchoGuide
        </Text>
        <Text style={styles.subtitle}>
          Bilingual Voice Control for Android • ድምጽ መቆጣጠሪያ
        </Text>
      </View>

      {/* Language Selection Card (§1, §5.3) */}
      <Card style={styles.card} accessibilityLabel="Language Choice Container">
        <Text style={styles.stepTitle}>Step 1. Choose Primary Language</Text>
        <Text style={styles.cardSubtitle}>
          Transcripts and Text-to-Speech will default to your selection.
        </Text>

        <TouchableOpacity
          style={[styles.langButton, selectedLang === 'am-ET' && styles.langButtonActive]}
          onPress={() => handleLanguageSelect('am-ET')}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 22, marginRight: 12 }}>🇪🇹</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.langTitle}>አማርኛ (Amharic)</Text>
            <Text style={styles.langDesc}>Addis AI Cloud STT Engine • 3% WER</Text>
          </View>
          {selectedLang === 'am-ET' && <Text style={styles.checkIcon}>✓</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.langButton, selectedLang === 'en-US' && styles.langButtonActive]}
          onPress={() => handleLanguageSelect('en-US')}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 22, marginRight: 12 }}>🇺🇸</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.langTitle}>English (US)</Text>
            <Text style={styles.langDesc}>On-Device Android Engine • Ultra low latency</Text>
          </View>
          {selectedLang === 'en-US' && <Text style={styles.checkIcon}>✓</Text>}
        </TouchableOpacity>
      </Card>

      {/* Consent & Privacy Card (§9.3, §10.1) */}
      <Card style={styles.card} accessibilityLabel="Privacy and Consent Container">
        <Text style={styles.stepTitle}>Step 2. Privacy & Voice Consent</Text>
        <Text style={styles.cardBody}>
          EchoGuide processes audio buffers exclusively to execute spoken commands.
          By default, zero audio recordings or spoken transcripts are stored (§9.1).
        </Text>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>
            Grant Voice Data Processing Consent
          </Text>
          <Switch
            value={consentGranted}
            onValueChange={setConsentGranted}
            trackColor={{ false: Theme.colors.border, true: Theme.colors.primary }}
            thumbColor={consentGranted ? '#FFFFFF' : Theme.colors.textMuted}
          />
        </View>
      </Card>

      {/* Accessibility Service Status Card (§D1, §5.3) */}
      <Card style={styles.card} accessibilityLabel="Accessibility Service Status Container">
        <Text style={styles.stepTitle}>Step 3. Android Accessibility Service</Text>
        <Text style={styles.cardBody}>
          EchoGuide requires AccessibilityService permissions to perform tap gestures, scroll views, and assist navigation.
        </Text>

        <View style={styles.statusBox}>
          <StatusBadge
            status={serviceState.isAccessibilityEnabled ? 'active' : 'inactive'}
            label={serviceState.isAccessibilityEnabled ? 'SERVICE ACTIVE' : 'SETUP REQUIRED'}
          />
          <Text style={styles.statusNote}>
            {serviceState.isAccessibilityEnabled
              ? 'Kotlin Native Accessibility Service is connected.'
              : 'Will prompt for Android Settings permission.'}
          </Text>
        </View>
      </Card>

      {/* Finish Button */}
      <View style={{ marginTop: Theme.spacing.md, marginBottom: Theme.spacing.lg }}>
        <PrimaryButton
          title={isSubmitting ? 'Configuring Assistant...' : 'Complete Setup & Launch'}
          onPress={handleFinishOnboarding}
          variant="glow"
          disabled={!consentGranted || isSubmitting}
          icon="🚀"
        />
      </View>
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
    paddingTop: Theme.spacing.xl,
    paddingBottom: Theme.spacing.xxl,
  },
  headerBox: {
    marginBottom: Theme.spacing.lg,
    alignItems: 'center',
  },
  badgeRow: {
    marginBottom: Theme.spacing.sm,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Theme.colors.primaryMuted,
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadow.glow,
  },
  title: {
    fontSize: Theme.typography.fontSizeDisplay,
    fontWeight: '900',
    color: Theme.colors.text,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Theme.typography.fontSizeSmall,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  card: {
    backgroundColor: Theme.colors.cardBackground,
    marginBottom: Theme.spacing.md,
  },
  stepTitle: {
    fontSize: Theme.typography.fontSizeSubheader,
    fontWeight: '800',
    color: Theme.colors.primary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    marginBottom: Theme.spacing.md,
  },
  cardBody: {
    fontSize: Theme.typography.fontSizeSmall,
    color: Theme.colors.textMuted,
    lineHeight: 20,
    marginBottom: Theme.spacing.md,
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: Theme.spacing.xs,
    backgroundColor: Theme.colors.surfaceElevated,
  },
  langButtonActive: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.primaryMuted,
    ...Theme.shadow.glow,
  },
  langTitle: {
    fontSize: Theme.typography.fontSizeBody,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  langDesc: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  checkIcon: {
    color: Theme.colors.primary,
    fontWeight: '900',
    fontSize: 18,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Theme.spacing.xs,
  },
  switchLabel: {
    fontSize: Theme.typography.fontSizeSmall,
    color: Theme.colors.text,
    flex: 1,
    fontWeight: '600',
    paddingRight: 10,
  },
  statusBox: {
    backgroundColor: Theme.colors.surfaceElevated,
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'flex-start',
  },
  statusNote: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    marginTop: Theme.spacing.xs,
  },
});
