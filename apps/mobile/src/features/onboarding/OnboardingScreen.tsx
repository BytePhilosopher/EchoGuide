import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Theme } from '../../design/theme';
import {
  Card,
  PrimaryButton,
  ProgressDots,
  IconCircle,
  Divider,
} from '../../design/SharedComponents';
import { useAppState } from '../../state/AppStateContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_STEPS = 4;

export const OnboardingScreen: React.FC = () => {
  const { state, dispatch } = useAppState();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedLang, setSelectedLang] = useState<'am-ET' | 'en-US'>(state.selectedLanguage);
  const [consentChecked, setConsentChecked] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goToStep = (step: number) => {
    scrollRef.current?.scrollTo({ x: step * SCREEN_WIDTH, animated: true });
    setCurrentStep(step);
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      goToStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    dispatch({ type: 'SET_LANGUAGE', language: selectedLang });
    dispatch({ type: 'SET_CONSENT', granted: consentChecked });
    dispatch({
      type: 'ADD_CONSENT_EVENT',
      event: {
        id: Date.now().toString(),
        scope: 'voice_data_processing',
        granted: consentChecked,
        timestamp: new Date().toISOString(),
      },
    });
    dispatch({ type: 'COMPLETE_ONBOARDING' });
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / SCREEN_WIDTH);
    if (page !== currentStep) {
      setCurrentStep(page);
    }
  };

  /* ─── Step 1: Welcome ───────────────────────────────────────── */
  const WelcomeStep = () => (
    <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
      <View style={styles.stepContent}>
        <View style={styles.heroSection}>
          <IconCircle icon="🎙️" color={Theme.colors.primary} bgColor={Theme.colors.primaryMuted} size={80} />
          <Text style={styles.heroTitle}>EchoGuide</Text>
          <Text style={styles.heroSubtitle}>Voice Accessibility Assistant</Text>
        </View>

        <Card style={styles.featureCard}>
          <View style={styles.featureRow}>
            <IconCircle icon="🗣️" color={Theme.colors.info} bgColor={Theme.colors.infoMuted} size={40} />
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Voice-Driven Control</Text>
              <Text style={styles.featureDesc}>Navigate any app on your phone using spoken commands</Text>
            </View>
          </View>
          <Divider spacing={Theme.spacing.sm} />
          <View style={styles.featureRow}>
            <IconCircle icon="🇪🇹" color={Theme.colors.warning} bgColor={Theme.colors.warningMuted} size={40} />
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Bilingual Support</Text>
              <Text style={styles.featureDesc}>Full Amharic and English voice recognition</Text>
            </View>
          </View>
          <Divider spacing={Theme.spacing.sm} />
          <View style={styles.featureRow}>
            <IconCircle icon="🔒" color={Theme.colors.success} bgColor={Theme.colors.successMuted} size={40} />
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Privacy First</Text>
              <Text style={styles.featureDesc}>No audio or transcripts stored by default</Text>
            </View>
          </View>
        </Card>

        <PrimaryButton
          title="Get Started"
          icon="👋"
          onPress={handleNext}
          style={{ marginTop: Theme.spacing.lg }}
        />
      </View>
    </View>
  );

  /* ─── Step 2: Language Selection ─────────────────────────────── */
  const LanguageStep = () => (
    <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Choose Your Language</Text>
        <Text style={styles.stepSubtitle}>ቋንቋ ይምረጡ / Select your primary language</Text>

        <TouchableOpacity
          style={[styles.langCard, selectedLang === 'am-ET' && styles.langCardActive]}
          onPress={() => setSelectedLang('am-ET')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Select Amharic Language"
          accessibilityState={{ selected: selectedLang === 'am-ET' }}
        >
          <IconCircle icon="🇪🇹" color={Theme.colors.warning} bgColor={Theme.colors.warningMuted} size={52} />
          <View style={styles.langInfo}>
            <Text style={styles.langName}>አማርኛ (Amharic)</Text>
            <Text style={styles.langDesc}>Powered by Addis AI Engine</Text>
            <Text style={styles.langDetail}>3% Word Error Rate • Cloud STT & TTS</Text>
          </View>
          {selectedLang === 'am-ET' && (
            <View style={styles.checkMark}>
              <Text style={{ color: Theme.colors.primary, fontSize: 20 }}>✓</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.langCard, selectedLang === 'en-US' && styles.langCardActive]}
          onPress={() => setSelectedLang('en-US')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Select English Language"
          accessibilityState={{ selected: selectedLang === 'en-US' }}
        >
          <IconCircle icon="🇺🇸" color={Theme.colors.info} bgColor={Theme.colors.infoMuted} size={52} />
          <View style={styles.langInfo}>
            <Text style={styles.langName}>English</Text>
            <Text style={styles.langDesc}>On-Device TTS • Near-Zero Latency</Text>
            <Text style={styles.langDetail}>Android native speech engine</Text>
          </View>
          {selectedLang === 'en-US' && (
            <View style={styles.checkMark}>
              <Text style={{ color: Theme.colors.primary, fontSize: 20 }}>✓</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.langNote}>
          You can change this later in Settings.
        </Text>

        <View style={styles.navButtons}>
          <PrimaryButton title="Back" onPress={handleBack} variant="ghost" style={{ flex: 1, marginRight: 8 }} />
          <PrimaryButton title="Continue" onPress={handleNext} style={{ flex: 1, marginLeft: 8 }} />
        </View>
      </View>
    </View>
  );

  /* ─── Step 3: Consent & Privacy ──────────────────────────────── */
  const ConsentStep = () => (
    <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Privacy & Consent</Text>
        <Text style={styles.stepSubtitle}>
          EchoGuide needs your permission to process voice commands
        </Text>

        <Card style={{ marginTop: Theme.spacing.md }}>
          <Text style={styles.consentHeading}>What We Process</Text>
          <View style={styles.consentItem}>
            <Text style={styles.consentBullet}>🎤</Text>
            <Text style={styles.consentText}>
              Your voice commands are sent to our server for transcription and action planning.
            </Text>
          </View>
          <View style={styles.consentItem}>
            <Text style={styles.consentBullet}>📱</Text>
            <Text style={styles.consentText}>
              Current screen context (app name and button labels) is sent to plan actions.
            </Text>
          </View>

          <Divider />

          <Text style={styles.consentHeading}>What We Never Do (Default)</Text>
          <View style={styles.consentItem}>
            <Text style={styles.consentBullet}>🚫</Text>
            <Text style={styles.consentText}>
              Audio recordings are NOT stored. Transcripts are NOT saved. Voice data exists only during processing.
            </Text>
          </View>
          <View style={styles.consentItem}>
            <Text style={styles.consentBullet}>🔐</Text>
            <Text style={styles.consentText}>
              You can delete all your data at any time from Settings.
            </Text>
          </View>
        </Card>

        {/* Amharic consent summary */}
        <Card style={{ marginTop: Theme.spacing.sm, backgroundColor: Theme.colors.surfaceElevated }}>
          <Text style={[styles.consentText, { fontStyle: 'italic' }]}>
            🇪🇹 ድምጽዎ ለአገልግሎት ብቻ ይሰራል። ምንም ቅጂ አይቀመጥም። በማንኛውም ጊዜ ፈቃድዎን ሊሰርዙ ይችላሉ።
          </Text>
        </Card>

        <TouchableOpacity
          style={[styles.consentToggle, consentChecked && styles.consentToggleActive]}
          onPress={() => setConsentChecked(!consentChecked)}
          activeOpacity={0.7}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consentChecked }}
          accessibilityLabel="I consent to voice data processing"
        >
          <View style={[styles.checkbox, consentChecked && styles.checkboxChecked]}>
            {consentChecked && <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓</Text>}
          </View>
          <Text style={styles.consentToggleText}>
            I consent to voice data processing for accessibility automation
          </Text>
        </TouchableOpacity>

        <View style={styles.navButtons}>
          <PrimaryButton title="Back" onPress={handleBack} variant="ghost" style={{ flex: 1, marginRight: 8 }} />
          <PrimaryButton
            title="Continue"
            onPress={handleNext}
            disabled={!consentChecked}
            style={{ flex: 1, marginLeft: 8 }}
          />
        </View>
      </View>
    </View>
  );

  /* ─── Step 4: Accessibility Setup ────────────────────────────── */
  const AccessibilityStep = () => (
    <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Enable Accessibility</Text>
        <Text style={styles.stepSubtitle}>
          EchoGuide needs the Android Accessibility Service to control apps on your behalf
        </Text>

        <Card style={{ marginTop: Theme.spacing.md }}>
          <View style={styles.setupStep}>
            <View style={styles.setupNumber}>
              <Text style={styles.setupNumberText}>1</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.setupStepTitle}>Open Android Settings</Text>
              <Text style={styles.setupStepDesc}>Go to Settings → Accessibility</Text>
            </View>
          </View>

          <View style={styles.setupStep}>
            <View style={styles.setupNumber}>
              <Text style={styles.setupNumberText}>2</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.setupStepTitle}>Find EchoGuide</Text>
              <Text style={styles.setupStepDesc}>Look for "EchoGuide" in the installed services list</Text>
            </View>
          </View>

          <View style={styles.setupStep}>
            <View style={styles.setupNumber}>
              <Text style={styles.setupNumberText}>3</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.setupStepTitle}>Enable the Service</Text>
              <Text style={styles.setupStepDesc}>Toggle it on and confirm the permission dialog</Text>
            </View>
          </View>
        </Card>

        <Card style={{ marginTop: Theme.spacing.sm, backgroundColor: Theme.colors.warningMuted, borderColor: Theme.colors.warning }}>
          <Text style={[styles.consentText, { color: Theme.colors.warning }]}>
            ⚠️ Without this service enabled, EchoGuide cannot perform actions in other apps. You can enable it later from Settings.
          </Text>
        </Card>

        <View style={styles.navButtons}>
          <PrimaryButton title="Back" onPress={handleBack} variant="ghost" style={{ flex: 1, marginRight: 8 }} />
          <PrimaryButton
            title="Continue to App"
            icon="🚀"
            onPress={handleComplete}
            style={{ flex: 1, marginLeft: 8 }}
          />
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEnabled={false}
        style={{ flex: 1 }}
      >
        <WelcomeStep />
        <LanguageStep />
        <ConsentStep />
        <AccessibilityStep />
      </ScrollView>

      <View style={styles.footer}>
        <ProgressDots total={TOTAL_STEPS} current={currentStep} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  stepContainer: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
    padding: Theme.spacing.lg,
    paddingTop: Theme.spacing.xxl,
  },
  footer: {
    paddingVertical: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xl,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  heroTitle: {
    fontSize: Theme.typography.fontSizeHero,
    fontWeight: '800',
    color: Theme.colors.text,
    marginTop: Theme.spacing.md,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: Theme.typography.fontSizeSubheader,
    color: Theme.colors.textMuted,
    marginTop: Theme.spacing.xs,
  },
  featureCard: {
    marginTop: Theme.spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    marginLeft: Theme.spacing.sm,
    flex: 1,
  },
  featureTitle: {
    fontSize: Theme.typography.fontSizeBody,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  featureDesc: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  stepTitle: {
    fontSize: Theme.typography.fontSizeHeader,
    fontWeight: '800',
    color: Theme.colors.text,
    letterSpacing: -0.3,
  },
  stepSubtitle: {
    fontSize: Theme.typography.fontSizeSmall,
    color: Theme.colors.textMuted,
    marginTop: Theme.spacing.xs,
    lineHeight: 20,
  },
  langCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.cardBackground,
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: Theme.colors.border,
    marginTop: Theme.spacing.md,
  },
  langCardActive: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.primaryMuted,
  },
  langInfo: {
    marginLeft: Theme.spacing.sm,
    flex: 1,
  },
  langName: {
    fontSize: Theme.typography.fontSizeSubheader,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  langDesc: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  langDetail: {
    fontSize: Theme.typography.fontSizeMicro,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  langNote: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    marginTop: Theme.spacing.md,
  },
  checkMark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consentHeading: {
    fontSize: Theme.typography.fontSizeBody,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.sm,
  },
  consentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Theme.spacing.sm,
  },
  consentBullet: {
    fontSize: 16,
    marginRight: Theme.spacing.sm,
    marginTop: 2,
  },
  consentText: {
    fontSize: Theme.typography.fontSizeSmall,
    color: Theme.colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  consentToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.cardBackground,
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 2,
    borderColor: Theme.colors.border,
    marginTop: Theme.spacing.md,
  },
  consentToggleActive: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.primaryMuted,
  },
  consentToggleText: {
    flex: 1,
    fontSize: Theme.typography.fontSizeSmall,
    color: Theme.colors.text,
    fontWeight: '600',
    marginLeft: Theme.spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  setupStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  setupNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.sm,
  },
  setupNumberText: {
    color: Theme.colors.text,
    fontSize: Theme.typography.fontSizeBody,
    fontWeight: '700',
  },
  setupStepTitle: {
    fontSize: Theme.typography.fontSizeBody,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  setupStepDesc: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  navButtons: {
    flexDirection: 'row',
    marginTop: Theme.spacing.lg,
  },
});
