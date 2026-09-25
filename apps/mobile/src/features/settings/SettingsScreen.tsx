import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Theme } from '../../design/theme';
import { Card, Divider, PrimaryButton, SectionHeader, SettingRow } from '../../design/SharedComponents';
import { VoicePipelineBridge, type LanguageCode } from '../../native/VoicePipelineBridge';
import { useAppState } from '../../state/AppStateContext';
import { t } from '../../i18n/strings';

const LANGUAGES: { code: LanguageCode; native: string; descKey: 'amharicEngine' | 'englishEngine' }[] = [
  { code: 'am-ET', native: 'አማርኛ', descKey: 'amharicEngine' },
  { code: 'en-US', native: 'English', descKey: 'englishEngine' },
];

const WAKE_WORDS = ['echo', 'hey echo'];

export const SettingsScreen: React.FC = () => {
  const { state, dispatch } = useAppState();
  const [wakeWordActive, setWakeWordActive] = useState(false);
  const [wakeWord, setWakeWord] = useState('echo');
  const [isRevoking, setIsRevoking] = useState(false);
  const lang = state.selectedLanguage;

  useEffect(() => {
    VoicePipelineBridge.getServiceState().then((service) => {
      setWakeWordActive(service.isWakeWordActive);
      setWakeWord(service.wakeWord);
    });
  }, []);

  const handleLanguageChange = async (next: LanguageCode) => {
    dispatch({ type: 'SET_LANGUAGE', language: next });
    await VoicePipelineBridge.setLanguage(next);
  };

  const handleRevokeConsent = () => {
    Alert.alert(t('revokeConsentTitle', lang), t('revokeConsentBody', lang), [
      { text: t('cancel', lang), style: 'cancel' },
      {
        text: t('revokeConsent', lang),
        style: 'destructive',
        onPress: async () => {
          setIsRevoking(true);
          await VoicePipelineBridge.revokeConsent();
          dispatch({ type: 'SET_CONSENT', granted: false });
          setIsRevoking(false);
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title} accessibilityRole="header">
        {t('settingsTitle', lang)}
      </Text>
      <Text style={styles.subtitle}>{t('settingsSubtitle', lang)}</Text>

      <SectionHeader title={t('sectionLanguage', lang)} />
      <Card>
        {LANGUAGES.map((option, index) => {
          const isSelected = lang === option.code;
          return (
            <React.Fragment key={option.code}>
              {index > 0 ? <Divider spacing={Theme.spacing.sm} /> : null}
              <Pressable
                onPress={() => handleLanguageChange(option.code)}
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

      <SectionHeader title={t('sectionVoice', lang)} />
      <Card>
        <SettingRow
          label={t('wakeWordLabel', lang)}
          description={t('wakeWordSub', lang)}
          value={wakeWordActive}
          onValueChange={(next) => {
            setWakeWordActive(next);
            if (next) VoicePipelineBridge.startListening();
            else VoicePipelineBridge.stopListening();
          }}
        />
        <Divider spacing={Theme.spacing.xs} />
        <SettingRow
          label={t('retentionLabel', lang)}
          description={t('retentionSub', lang)}
          value={state.dataRetentionOptIn}
          onValueChange={(next) => dispatch({ type: 'SET_DATA_RETENTION', optIn: next })}
        />
      </Card>

      <SectionHeader title={t('sectionWakeWord', lang)} subtitle={t('wakeWordPickerHint', lang)} />
      <Card>
        {WAKE_WORDS.map((phrase, index) => {
          const isSelected = wakeWord === phrase;
          return (
            <React.Fragment key={phrase}>
              {index > 0 ? <Divider spacing={Theme.spacing.sm} /> : null}
              <Pressable
                onPress={async () => {
                  setWakeWord(phrase);
                  dispatch({ type: 'SET_WAKE_WORD', word: phrase });
                  await VoicePipelineBridge.setWakeWord(phrase);
                }}
                accessibilityRole="radio"
                accessibilityLabel={phrase}
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
              >
                <Text style={styles.optionTitle}>{`“${phrase}”`}</Text>
                {isSelected ? <Check size={22} color={Theme.colors.accent} strokeWidth={2.25} /> : null}
              </Pressable>
            </React.Fragment>
          );
        })}
      </Card>

      <SectionHeader title={t('sectionPrivacy', lang)} />
      <Card>
        <Text style={styles.privacyTitle}>{t('revocationLabel', lang)}</Text>
        <Text style={styles.privacyBody}>{t('revocationSub', lang)}</Text>
        <PrimaryButton
          title={t('revokeConsent', lang)}
          onPress={handleRevokeConsent}
          variant="danger"
          loading={isRevoking}
          style={styles.revokeButton}
        />
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Theme.colors.ground },
  content: {
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.sm,
    paddingBottom: Theme.spacing.xxl,
  },
  title: { ...Theme.type.display, color: Theme.colors.strong },
  subtitle: { ...Theme.type.body, color: Theme.colors.muted, marginTop: Theme.spacing.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Theme.touchTarget,
  },
  optionPressed: { opacity: 0.7 },
  optionText: { flex: 1, paddingRight: Theme.spacing.md },
  optionTitle: { ...Theme.type.body, color: Theme.colors.strong, flex: 1 },
  optionDesc: { ...Theme.type.caption, color: Theme.colors.muted, marginTop: 2 },
  privacyTitle: { ...Theme.type.bodyStrong, color: Theme.colors.strong },
  privacyBody: {
    ...Theme.type.body,
    color: Theme.colors.base,
    marginTop: Theme.spacing.xs,
  },
  revokeButton: { marginTop: Theme.spacing.md },
});
