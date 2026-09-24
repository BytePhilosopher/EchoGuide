import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Theme } from '../../design/theme';
import { VoicePipelineBridge } from '../../native/VoicePipelineBridge';

export const AccountScreen: React.FC = () => {
  const [deviceHash, setDeviceHash] = useState<string>('sha256:8f9a2b7c4d1e0f3a...');
  const [installId, setInstallId] = useState<string>('inst_99cd28c1_accf');
  const [subStatus, setSubStatus] = useState<string>('EchoGuide Accessibility Pro (Active)');

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
    >
      <Text style={styles.header} accessibilityRole="header">
        User Account & Binding
      </Text>
      <Text style={styles.headerSubtitle}>
        Device identity, session binding, and plan status (§10.4)
      </Text>

      {/* Identity & Session Card (§10.4) */}
      <View style={styles.card} accessibilityLabel="Device Identity Details">
        <Text style={styles.cardTitle} accessibilityRole="header">
          Device Identity & Binding
        </Text>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Hashed Phone ID (§10.4):</Text>
          <Text style={styles.value} accessibilityLabel={`Hashed Phone ID: ${deviceHash}`}>
            {deviceHash}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Installation Binding (install_id):</Text>
          <Text style={styles.value} accessibilityLabel={`Install ID: ${installId}`}>
            {installId}
          </Text>
        </View>
      </View>

      {/* Subscription Plan Card */}
      <View style={styles.card} accessibilityLabel="Subscription Status">
        <Text style={styles.cardTitle} accessibilityRole="header">
          Subscription Plan
        </Text>

        <View style={styles.subBox}>
          <Text style={styles.subText}>{subStatus}</Text>
          <Text style={styles.subMeta}>Renews automatically on Oct 24, 2026</Text>
        </View>
      </View>

      {/* Sign Out / Revoke Session Button */}
      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={handleSignOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out of device account"
        accessibilityHint="Clears local device session token"
      >
        <Text style={styles.signOutText}>Sign Out of Device Account</Text>
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
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    fontSize: 26,
    fontWeight: 'bold',
    color: Theme.colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Theme.colors.textMuted,
    marginBottom: 20,
  },
  card: {
    backgroundColor: Theme.colors.cardBackground,
    padding: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.text,
    marginBottom: 14,
  },
  infoRow: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: Theme.colors.text,
  },
  subBox: {
    backgroundColor: 'rgba(35, 134, 54, 0.15)',
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    padding: 14,
    borderRadius: 8,
  },
  subText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Theme.colors.primaryHover,
  },
  subMeta: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 4,
  },
  signOutBtn: {
    backgroundColor: Theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  signOutText: {
    color: Theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});
