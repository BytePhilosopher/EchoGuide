import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Theme } from '../../design/theme';
import {
  Card,
  Divider,
  PrimaryButton,
  SectionHeader,
  SettingRow,
  StatusBadge,
} from '../../design/SharedComponents';
import {
  VoicePipelineBridge,
  type LanguageCode,
  type ServiceState,
} from '../../native/VoicePipelineBridge';
import { useAppState } from '../../state/AppStateContext';
import { t } from '../../i18n/strings';

interface OnboardingScreenProps {
  onComplete?: () => void;
}

const LANGUAGES: { code: LanguageCode; native: string; descKey: 'amharicDesc' | 'englishDesc' }[] = [
  { code: 'am-ET', native: 'አማርኛ', descKey: 'amharicDesc' },
  { code: 'en-US', native: 'English', descKey: 'englishDesc' },
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const { dispatch } = useAppState();
  const [lang, setLang] = useState<LanguageCode>('am-ET');
  const [consentGranted, setConsentGranted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [service, setService] = useState<ServiceState | null>(null);

  useEffect(() => {
    VoicePipelineBridge.getServiceState().then(setService);
  }, []);

  const handleLanguage = async (next: LanguageCode) => {
    setLang(next);
    await VoicePipelineBridge.setLanguage(next);
  };

  const handleFinish = async () => {
    if (!consentGranted) {
      Alert.alert(t('consentRequired', lang), t('consentRequiredBody', lang));
      return;
    }
    setIsSubmitting(true);
    await VoicePipelineBridge.setLanguage(lang);
    await VoicePipelineBridge.setConsent(true);
    await VoicePipelineBridge.registerDevice();
    dispatch({ type: 'SET_LANGUAGE', language: lang });
    dispatch({ type: 'SET_CONSENT', granted: true });
    setIsSubmitting(false);
    onComplete?.();
  };

  const accessibilityOn = service?.isAccessibilityEnabled ?? false;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      accessibilityLabel={t('onboardingScreenLabel', lang)}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title} accessibilityRole="header">
        {t('welcomeTitle', lang)}
      </Text>
      <Text style={styles.subtitle}>{t('welcomeSubtitle', lang)}</Text>

      <SectionHeader title={t('step1Title', lang)} subtitle={t('step1Subtitle', lang)} />
      <Card>
        {LANGUAGES.map((option, index) => {
          const isSelected = lang === option.code;
          return (
            <React.Fragment key={option.code}>
              {index > 0 ? <Divider spacing={Theme.spacing.sm} /> : null}
              <Pressable
                onPress={() => handleLanguage(option.code)}
                accessibilityRole="radio"
                accessibilityLabel={option.native}
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
              >
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>{option.native}</Text>
                  <Text style={styles.optionDesc}>{t(option.descKey, lang)}</Text>
                </View>
                {isSelected ? <Check size={22} color={Theme.colors.accent} strokeWidth={2.25} /> : null}
              </Pressable>
            </React.Fragment>
          );
        })}
      </Card>

      <SectionHeader title={t('step2Title', lang)} />
      <Card>
        <Text style={styles.body}>{t('step2Body', lang)}</Text>
        <Divider spacing={Theme.spacing.sm} />
        <SettingRow
          label={t('grantConsent', lang)}
          value={consentGranted}
          onValueChange={setConsentGranted}
        />
      </Card>

      <SectionHeader title={t('step3Title', lang)} />
      <Card>
        <Text style={styles.body}>{t('step3Body', lang)}</Text>
        <View style={styles.statusRow}>
          <StatusBadge
            tone={accessibilityOn ? 'positive' : 'neutral'}
            label={accessibilityOn ? t('serviceActive', lang) : t('serviceSetupNeeded', lang)}
          />
        </View>
        <Text style={styles.hint}>
          {accessibilityOn ? t('serviceConnected', lang) : t('serviceWillPrompt', lang)}
        </Text>
      </Card>

      <PrimaryButton
        title={t('finishSetup', lang)}
        onPress={handleFinish}
        disabled={!consentGranted}
        loading={isSubmitting}
        style={styles.finish}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Theme.colors.ground },
  content: {
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.xl,
    paddingBottom: Theme.spacing.xxl,
  },
  title: { ...Theme.type.display, color: Theme.colors.strong },
  subtitle: {
    ...Theme.type.body,
    color: Theme.colors.base,
    marginTop: Theme.spacing.sm,
  },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: Theme.touchTarget },
  optionPressed: { opacity: 0.7 },
  optionText: { flex: 1, paddingRight: Theme.spacing.md },
  optionTitle: { ...Theme.type.body, color: Theme.colors.strong },
  optionDesc: { ...Theme.type.caption, color: Theme.colors.muted, marginTop: 2 },
  body: { ...Theme.type.body, color: Theme.colors.base },
  statusRow: { marginTop: Theme.spacing.md },
  hint: { ...Theme.type.caption, color: Theme.colors.muted, marginTop: Theme.spacing.sm },
  finish: { marginTop: Theme.spacing.xl },
});
