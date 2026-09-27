import React from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { Theme } from '../../design/theme';
import { PrimaryButton } from '../../design/SharedComponents';
import { VoicePipelineBridge } from '../../native/VoicePipelineBridge';
import { t, type Locale, type StringKey } from '../../i18n/strings';

type Step = { text: StringKey; action?: 'accessibility' | 'appInfo' };

// Android 13+ blocks accessibility for apps installed outside a store until the user allows it
// from App info, so those phones need the extra unlock steps.
const IS_RESTRICTED = Platform.OS === 'android' && Platform.Version >= 33;

const STEPS: Step[] = IS_RESTRICTED
  ? [
      { text: 'a11yStepOpen', action: 'accessibility' },
      { text: 'a11yStepRestricted' },
      { text: 'a11yStepAllow', action: 'appInfo' },
      { text: 'a11yStepFinish', action: 'accessibility' },
    ]
  : [{ text: 'a11yStepOpen', action: 'accessibility' }, { text: 'a11yStepConfirm' }];

export const AccessibilitySetupGuide: React.FC<{ language: Locale }> = ({ language }) => (
  <View>
    {STEPS.map((step, index) => (
      <View key={step.text} style={[styles.step, index > 0 && styles.stepGap]}>
        <View style={styles.number} importantForAccessibility="no-hide-descendants">
          <Text style={styles.numberText}>{index + 1}</Text>
        </View>
        <View style={styles.stepBody}>
          <Text style={styles.stepText} accessibilityLabel={`${index + 1}. ${t(step.text, language)}`}>
            {t(step.text, language)}
          </Text>
          {step.action === 'accessibility' ? (
            <PrimaryButton
              title={t('openAccessibility', language)}
              onPress={() => VoicePipelineBridge.openAccessibilitySettings()}
              accessibilityHint={t('openAccessibilityHint', language)}
              variant={index === 0 ? 'primary' : 'secondary'}
              style={styles.action}
            />
          ) : null}
          {step.action === 'appInfo' ? (
            <PrimaryButton
              title={t('openAppInfo', language)}
              onPress={() => Linking.openSettings()}
              variant="secondary"
              style={styles.action}
            />
          ) : null}
        </View>
      </View>
    ))}
    <Text style={styles.footer}>{t('a11yStepDone', language)}</Text>
  </View>
);

const NUMBER_SIZE = 28;

const styles = StyleSheet.create({
  step: { flexDirection: 'row', alignItems: 'flex-start' },
  stepGap: { marginTop: Theme.spacing.lg },
  number: {
    width: NUMBER_SIZE,
    height: NUMBER_SIZE,
    borderRadius: NUMBER_SIZE / 2,
    borderWidth: 1,
    borderColor: Theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
    marginTop: 1,
  },
  numberText: { ...Theme.type.caption, color: Theme.colors.accent },
  stepBody: { flex: 1 },
  stepText: { ...Theme.type.body, color: Theme.colors.base },
  action: { marginTop: Theme.spacing.md },
  footer: { ...Theme.type.caption, color: Theme.colors.muted, marginTop: Theme.spacing.lg },
});
