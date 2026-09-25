import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Theme } from '../../design/theme';
import { Card, Divider, SectionHeader, StatusBadge } from '../../design/SharedComponents';
import { VoicePipelineBridge } from '../../native/VoicePipelineBridge';
import { useAppState } from '../../state/AppStateContext';
import { t } from '../../i18n/strings';

export const AccountScreen: React.FC = () => {
  const { state } = useAppState();
  const lang = state.selectedLanguage;
  const [installId, setInstallId] = useState<string>('');

  useEffect(() => {
    VoicePipelineBridge.getServiceState().then((service) => setInstallId(service.installId));
  }, []);

  const { subscription } = state;
  const isActive = subscription.status === 'active';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      accessibilityLabel={t('accountTitle', lang)}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.header} accessibilityRole="header">
        {t('accountTitle', lang)}
      </Text>
      <Text style={styles.headerSubtitle}>{t('accountSubtitle', lang)}</Text>

      <SectionHeader title={t('sectionPlan', lang)} />
      <Card
        style={styles.card}
        accessible
        accessibilityLabel={`${isActive ? subscription.plan : t('planNone', lang)}, ${
          isActive ? t('statusActive', lang) : t('statusInactive', lang)
        }`}
      >
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.planTitle}>
              {isActive ? subscription.plan : t('planNone', lang)}
            </Text>
            <Text style={styles.meta}>
              {subscription.renewsAt
                ? `${t('planRenews', lang)} ${subscription.renewsAt}`
                : t('planNoRenewal', lang)}
            </Text>
          </View>
          <StatusBadge
            tone={isActive ? 'positive' : 'neutral'}
            label={isActive ? t('statusActive', lang) : t('statusInactive', lang)}
          />
        </View>

        <Divider spacing={Theme.spacing.sm} />

        <Text style={styles.meta}>
          {t('commandsUsed', lang)}: {subscription.commandsThisPeriod}
        </Text>
      </Card>

      <SectionHeader title={t('sectionDevice', lang)} />
      <Card
        style={styles.card}
        accessible
        accessibilityLabel={`${t('installIdLabel', lang)}: ${
          installId || t('installIdUnknown', lang)
        }`}
      >
        <Text style={styles.label}>{t('installIdLabel', lang)}</Text>
        <View style={styles.idChip}>
          <Text style={styles.idText}>{installId || t('installIdUnknown', lang)}</Text>
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
    color: Theme.colors.text,
    fontSize: Theme.type.display.fontSize,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: Theme.colors.textSecondary,
    fontSize: Theme.type.label.fontSize,
    marginTop: Theme.spacing.xs,
    marginBottom: Theme.spacing.md,
  },
  card: {
    marginBottom: Theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planTitle: {
    color: Theme.colors.text,
    fontSize: Theme.type.heading.fontSize,
    fontWeight: '600',
  },
  meta: {
    color: Theme.colors.textMuted,
    fontSize: Theme.type.label.fontSize,
    marginTop: Theme.spacing.xs,
  },
  label: {
    color: Theme.colors.textSecondary,
    fontSize: Theme.type.label.fontSize,
    marginBottom: Theme.spacing.xs,
  },
  idChip: {
    backgroundColor: Theme.colors.sunken,
    borderRadius: Theme.radius.sm,
    paddingVertical: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.sm,
  },
  idText: {
    color: Theme.colors.textSecondary,
    fontSize: Theme.type.caption.fontSize,
    fontFamily: 'monospace',
  },
});
