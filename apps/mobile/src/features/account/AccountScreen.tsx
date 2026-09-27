import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, ScrollView } from 'react-native';
import { Theme } from '../../design/theme';
import {
  Card,
  Divider,
  PrimaryButton,
  SectionHeader,
  StatusBadge,
} from '../../design/SharedComponents';
import { VoicePipelineBridge, type Entitlement } from '../../native/VoicePipelineBridge';
import { useAppState } from '../../state/AppStateContext';
import { t, type Locale } from '../../i18n/strings';

const PLAN_NAME = 'EchoGuide';

type PlanStatus = 'loading' | 'unavailable' | Entitlement;

const PlanCard: React.FC<{ plan: Entitlement; lang: Locale }> = ({ plan, lang }) => {
  const isActive = !plan.isEnforced || plan.state === 'ACTIVE' || plan.state === 'TRIAL';
  const title = !plan.isEnforced
    ? t('planFree', lang)
    : isActive
      ? PLAN_NAME
      : t('planNone', lang);
  const detail = !plan.isEnforced
    ? t('planFreeSub', lang)
    : plan.renewsAt
      ? `${t('planRenews', lang)} ${new Date(plan.renewsAt).toLocaleDateString(lang)}`
      : t('planNoRenewal', lang);
  const status = isActive ? t('statusActive', lang) : t('statusInactive', lang);

  return (
    <Card style={styles.card} accessible accessibilityLabel={`${title}, ${status}. ${detail}`}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.planTitle}>{title}</Text>
          <Text style={styles.meta}>{detail}</Text>
        </View>
        <StatusBadge tone={isActive ? 'positive' : 'neutral'} label={status} />
      </View>

      {plan.commandsUsed !== null ? (
        <>
          <Divider spacing={Theme.spacing.sm} />
          <Text style={styles.meta}>
            {t('commandsUsed', lang)}: {plan.commandsUsed}
            {plan.commandQuota !== null ? ` / ${plan.commandQuota}` : ''}
          </Text>
        </>
      ) : null}
    </Card>
  );
};

export const AccountScreen: React.FC = () => {
  const { state } = useAppState();
  const lang = state.selectedLanguage;
  const [installId, setInstallId] = useState<string>('');

  const [plan, setPlan] = useState<PlanStatus>('loading');

  const loadPlan = useCallback(async () => {
    setPlan('loading');
    setPlan((await VoicePipelineBridge.getEntitlement()) ?? 'unavailable');
  }, []);

  useEffect(() => {
    VoicePipelineBridge.getServiceState().then((service) => setInstallId(service.installId));
    loadPlan();
  }, [loadPlan]);

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
      {plan === 'loading' ? (
        <Card style={styles.card} accessible accessibilityLabel={t('planLoading', lang)}>
          <ActivityIndicator color={Theme.colors.muted} style={styles.planPending} />
        </Card>
      ) : plan === 'unavailable' ? (
        <Card style={styles.card}>
          <Text style={styles.meta} accessibilityRole="alert">
            {t('planUnavailable', lang)}
          </Text>
          <PrimaryButton
            title={t('planRetry', lang)}
            onPress={loadPlan}
            variant="secondary"
            style={styles.retry}
          />
        </Card>
      ) : (
        <PlanCard plan={plan} lang={lang} />
      )}

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
  planPending: {
    minHeight: Theme.touchTarget,
  },
  retry: {
    marginTop: Theme.spacing.md,
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
