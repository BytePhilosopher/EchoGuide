import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Theme } from '../../design/theme';
import { PrimaryButton } from '../../design/SharedComponents';
import { VoicePipelineBridge } from '../../native/VoicePipelineBridge';
import { isAwaitingConfirmation, usePipelineState } from '../../native/usePipelineState';
import { useAppState } from '../../state/AppStateContext';
import { t } from '../../i18n/strings';

export const ConfirmationOverlay: React.FC = () => {
  const pipeline = usePipelineState();
  const { state } = useAppState();
  const language = state.selectedLanguage;
  const visible = isAwaitingConfirmation(pipeline);

  React.useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => VoicePipelineBridge.confirmPending(false)}
    >
      <View style={styles.backdrop}>
        <View
          style={styles.sheet}
          accessibilityViewIsModal
          accessibilityLiveRegion="assertive"
        >
          <Text style={styles.title} accessibilityRole="header">
            {t('confirmTitle', language)}
          </Text>
          <Text style={styles.body}>{t('confirmBody', language)}</Text>

          <PrimaryButton
            title={t('confirmYes', language)}
            onPress={() => VoicePipelineBridge.confirmPending(true)}
            variant="primary"
            accessibilityHint={t('confirmYesHint', language)}
            style={styles.action}
          />
          <PrimaryButton
            title={t('confirmNo', language)}
            onPress={() => VoicePipelineBridge.confirmPending(false)}
            variant="secondary"
            accessibilityHint={t('confirmNoHint', language)}
            style={styles.action}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: Theme.spacing.lg,
  },
  sheet: {
    backgroundColor: Theme.colors.raised,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: Theme.spacing.lg,
  },
  title: {
    color: Theme.colors.text,
    fontSize: Theme.type.title.fontSize,
    fontWeight: '700',
    marginBottom: Theme.spacing.sm,
  },
  body: {
    color: Theme.colors.textSecondary,
    fontSize: Theme.type.body.fontSize,
    lineHeight: 24,
    marginBottom: Theme.spacing.lg,
  },
  action: {
    marginTop: Theme.spacing.sm,
  },
});
