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
    >
      <View style={styles.headerBox}>
        <Text style={styles.title} accessibilityRole="header">
          EchoGuide Accessibility
        </Text>
        <Text style={styles.subtitle}>
          Bilingual Voice Control for Android • ድምጽ መቆጣጠሪያ
        </Text>
      </View>

      {/* Language Selection Card (§1, §5.3) */}
      <View style={styles.card} accessibilityLabel="Language Choice Container">
        <Text style={styles.cardTitle} accessibilityRole="header">
          1. Choose Primary Language / ቋንቋ ይምረጡ
        </Text>
        <Text style={styles.cardSubtitle}>
          Transcripts & TTS will default to your selected language.
        </Text>

        <TouchableOpacity
          style={[styles.langButton, selectedLang === 'am-ET' && styles.langButtonActive]}
          onPress={() => handleLanguageSelect('am-ET')}
          accessibilityRole="button"
          accessibilityLabel="Select Amharic Language, Addis AI Engine"
          accessibilityHint="Sets primary language to Amharic using Addis AI STT and TTS"
          accessibilityState={{ selected: selectedLang === 'am-ET' }}
        >
          <Text style={styles.langTitle}>አማርኛ (Amharic)</Text>
          <Text style={styles.langDesc}>Addis AI Engine • 3% WER • Cloud STT & TTS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.langButton, selectedLang === 'en-US' && styles.langButtonActive]}
          onPress={() => handleLanguageSelect('en-US')}
          accessibilityRole="button"
          accessibilityLabel="Select English US Language"
          accessibilityHint="Sets primary language to English using Android On-Device TTS"
          accessibilityState={{ selected: selectedLang === 'en-US' }}
        >
          <Text style={styles.langTitle}>English (US)</Text>
          <Text style={styles.langDesc}>On-Device Android Engine • Near-zero latency</Text>
        </TouchableOpacity>
      </View>

      {/* Consent & Privacy Card (§9.3, §10.1) */}
      <View style={styles.card} accessibilityLabel="Privacy and Consent Container">
        <Text style={styles.cardTitle} accessibilityRole="header">
          2. Privacy & Voice Consent / የግላዊነት ፈቃድ
        </Text>
        <Text style={styles.cardBody}>
          EchoGuide processes audio buffers exclusively to execute spoken commands.
          By default, no raw audio or transcripts are stored on our servers (§9.1).
        </Text>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel} accessibilityLabel="Grant Voice Data Processing Consent">
            Grant Voice Data Processing Consent
          </Text>
          <Switch
            value={consentGranted}
            onValueChange={setConsentGranted}
            trackColor={{ false: '#30363d', true: Theme.colors.primary }}
            accessibilityRole="switch"
            accessibilityLabel="Voice Data Processing Consent Switch"
            accessibilityState={{ checked: consentGranted }}
          />
        </View>
      </View>

      {/* Accessibility Service Status Card (§D1, §5.3) */}
      <View style={styles.card} accessibilityLabel="Accessibility Service Status Container">
        <Text style={styles.cardTitle} accessibilityRole="header">
          3. Android Accessibility Service
        </Text>
        <Text style={styles.cardBody}>
          EchoGuide requires Android AccessibilityService permissions to perform gestures
          and read view trees across installed applications.
        </Text>

        <View style={styles.statusBox}>
          <Text style={styles.statusText}>
            Service Status:{' '}
            <Text
              style={{
                color: serviceState.isAccessibilityEnabled
                  ? Theme.colors.primaryHover
                  : Theme.colors.warning,
                fontWeight: 'bold',
              }}
            >
              {serviceState.isAccessibilityEnabled ? 'ENABLED (Active)' : 'DISABLED (Setup Required)'}
            </Text>
          </Text>
        </View>
      </View>

      {/* Finish Button */}
      <TouchableOpacity
        style={[styles.primaryButton, (!consentGranted || isSubmitting) && styles.disabledButton]}
        onPress={handleFinishOnboarding}
        disabled={!consentGranted || isSubmitting}
        accessibilityRole="button"
        accessibilityLabel="Complete Setup and Launch Assistant"
        accessibilityHint="Saves preferences and activates the EchoGuide voice pipeline"
      >
        <Text style={styles.primaryButtonText}>
          {isSubmitting ? 'Configuring...' : 'Complete Setup & Continue'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  headerBox: {
    marginBottom: 24,
    marginTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Theme.colors.primary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: Theme.colors.textMuted,
  },
  card: {
    backgroundColor: Theme.colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 18,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Theme.colors.textMuted,
    marginBottom: 16,
  },
  cardBody: {
    fontSize: 14,
    color: Theme.colors.textMuted,
    lineHeight: 20,
    marginBottom: 14,
  },
  langButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: 12,
    backgroundColor: Theme.colors.background,
  },
  langButtonActive: {
    borderColor: Theme.colors.primary,
    backgroundColor: 'rgba(35, 134, 54, 0.15)',
  },
  langTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.text,
    marginBottom: 4,
  },
  langDesc: {
    fontSize: 12,
    color: Theme.colors.textMuted,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  switchLabel: {
    fontSize: 14,
    color: Theme.colors.text,
    flex: 1,
    paddingRight: 10,
  },
  statusBox: {
    backgroundColor: Theme.colors.background,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  statusText: {
    fontSize: 13,
    color: Theme.colors.text,
  },
  primaryButton: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
