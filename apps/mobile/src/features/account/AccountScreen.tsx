import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { Theme } from '../../design/theme';
import { Card, SectionHeader, StatusBadge, PrimaryButton, Divider } from '../../design/SharedComponents';

export const AccountScreen: React.FC = () => {
  const [deviceHash] = useState<string>('sha256:8f9a2b7c4d1e0f3a...');
  const [installId] = useState<string>('inst_99cd28c1_accf');
  const [subStatus] = useState<string>('EchoGuide Accessibility Pro');

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out / ውጣ',
      'Signing out will clear local session tokens bound to this install ID (§10.4).',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => console.log('User signed out') },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      accessibilityLabel="User Account and Subscription Screen"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.header} accessibilityRole="header">
        Account & Identity
      </Text>
      <Text style={styles.headerSubtitle}>
        Device identity, session binding, and plan status (§10.4)
      </Text>

      {/* Subscription Card */}
      <SectionHeader title="SUBSCRIPTION PLAN" badge="PRO §10" />
      <Card elevated style={styles.subCard}>
        <View style={styles.subHeaderRow}>
          <View style={styles.planIcon}>
            <Text style={{ fontSize: 24 }}>✨</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.planTitle}>{subStatus}</Text>
            <Text style={styles.planMeta}>Renews automatically Oct 24, 2026</Text>
          </View>
          <StatusBadge status="active" label="ACTIVE" />
        </View>

        <Divider spacing={Theme.spacing.sm} />

        <View style={styles.subFeaturesRow}>
          <View style={styles.featureItem}>
            <Text style={styles.featureCheck}>✓</Text>
            <Text style={styles.featureText}>Unlimited Amharic STT</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureCheck}>✓</Text>
            <Text style={styles.featureText}>Kotlin Native Engine</Text>
          </View>
        </View>
      </Card>

      {/* Device Identity & Session Card */}
      <SectionHeader title="DEVICE IDENTITY" badge="HARDWARE BINDING §10.4" />
      <Card style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Hashed Phone Fingerprint (§10.4):</Text>
          <View style={styles.hashChip}>
            <Text style={styles.hashText}>{deviceHash}</Text>
          </View>
        </View>

        <Divider spacing={Theme.spacing.xs} />

        <View style={styles.infoRow}>
          <Text style={styles.label}>Installation Binding (install_id):</Text>
          <View style={styles.hashChip}>
            <Text style={styles.hashText}>{installId}</Text>
          </View>
        </View>
      </Card>

      {/* Sign Out Button */}
      <View style={{ marginTop: Theme.spacing.lg }}>
        <PrimaryButton
          title="Sign Out of Device Session"
          onPress={handleSignOut}
          variant="ghost"
          icon="🚪"
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
  subCard: {
    backgroundColor: Theme.colors.cardBackground,
    borderColor: Theme.colors.primaryMuted,
    marginBottom: Theme.spacing.md,
  },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Theme.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.colors.primary,
  },
  planTitle: {
    fontSize: Theme.typography.fontSizeSubheader,
    fontWeight: '800',
    color: Theme.colors.text,
  },
  planMeta: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  subFeaturesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureCheck: {
    color: Theme.colors.primary,
    fontWeight: '900',
    marginRight: 6,
  },
  featureText: {
    fontSize: Theme.typography.fontSizeMicro,
    color: Theme.colors.textSecondary,
    fontWeight: '600',
  },
  infoRow: {
    paddingVertical: Theme.spacing.xs,
  },
  label: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    fontWeight: '600',
    marginBottom: 4,
  },
  hashChip: {
    backgroundColor: Theme.colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  hashText: {
    fontSize: Theme.typography.fontSizeSmall,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: Theme.colors.primary,
    fontWeight: '600',
  },
});
