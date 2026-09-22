import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Theme } from '../../design/theme';
import {
  Card,
  SectionHeader,
  SettingRow,
  PrimaryButton,
  StatusBadge,
  Divider,
} from '../../design/SharedComponents';
import { useAppState } from '../../state/AppStateContext';

export const SettingsScreen: React.FC = () => {
  const { state, dispatch } = useAppState();

  const handleDeleteAllData = () => {
    Alert.alert(
      'Delete All Data',
      'This will permanently delete all your data from our servers and reset the app. This action cannot be undone.\n\nይህ ሁሉንም መረጃዎን በቋሚነት ይሰርዛል።',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            dispatch({
              type: 'ADD_CONSENT_EVENT',
              event: {
                id: Date.now().toString(),
                scope: 'data_deletion_request',
                granted: true,
                timestamp: new Date().toISOString(),
              },
            });
            dispatch({ type: 'DELETE_ALL_DATA' });
          },
        },
      ],
    );
  };

  const handleRevokeConsent = () => {
    Alert.alert(
      'Revoke Consent',
      'Revoking consent will disable voice command processing. You can re-enable it later.\n\nፈቃድን መሰረዝ የድምጽ ትዕዛዞችን ያቆማል።',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () => {
            dispatch({ type: 'SET_CONSENT', granted: false });
            dispatch({
              type: 'ADD_CONSENT_EVENT',
              event: {
                id: Date.now().toString(),
                scope: 'voice_data_processing',
                granted: false,
                timestamp: new Date().toISOString(),
              },
            });
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Settings</Text>
      <Text style={styles.headerSub}>ቅንብሮች</Text>

      {/* ─── Voice & Language ──────────────────────────────────── */}
      <SectionHeader title="Voice & Language" subtitle="ድምጽ እና ቋንቋ" />

      <SettingRow
        icon="🌍"
        label="Primary Language"
        description={state.selectedLanguage === 'am-ET' ? 'አማርኛ (Amharic)' : 'English'}
        rightElement={
          <View style={styles.langToggle}>
            <PrimaryButton
              title="አማ"
              onPress={() => dispatch({ type: 'SET_LANGUAGE', language: 'am-ET' })}
              variant={state.selectedLanguage === 'am-ET' ? 'primary' : 'ghost'}
              style={styles.langBtn}
            />
            <PrimaryButton
              title="EN"
              onPress={() => dispatch({ type: 'SET_LANGUAGE', language: 'en-US' })}
              variant={state.selectedLanguage === 'en-US' ? 'primary' : 'ghost'}
              style={styles.langBtn}
            />
          </View>
        }
      />

      <SettingRow
        icon="⚡"
        label="Speech Rate"
        description={`${state.speechRate}% speed`}
        rightElement={
          <View style={styles.rateControls}>
            <PrimaryButton
              title="−"
              onPress={() => dispatch({ type: 'SET_SPEECH_RATE', rate: Math.max(50, state.speechRate - 10) })}
              variant="ghost"
              style={styles.rateBtn}
            />
            <Text style={styles.rateValue}>{state.speechRate}%</Text>
            <PrimaryButton
              title="+"
              onPress={() => dispatch({ type: 'SET_SPEECH_RATE', rate: Math.min(200, state.speechRate + 10) })}
              variant="ghost"
              style={styles.rateBtn}
            />
          </View>
        }
      />

      <SettingRow
        icon="🔊"
        label="Wake Word"
        description={`Current: "${state.wakeWord}"`}
        rightElement={
          <StatusBadge status="active" label={state.wakeWord} />
        }
      />

      {/* ─── Privacy & Data ────────────────────────────────────── */}
      <SectionHeader title="Privacy & Data" subtitle="ግላዊነት እና ዳታ (§D4)" />

      <SettingRow
        icon="📦"
        label="Audio Data Retention"
        description="Opt-in to store voice data for quality improvement. Default: OFF — no audio or transcripts saved."
        value={state.dataRetentionOptIn}
        onValueChange={(v) => {
          dispatch({ type: 'SET_DATA_RETENTION', optIn: v });
          dispatch({
            type: 'ADD_CONSENT_EVENT',
            event: {
              id: Date.now().toString(),
              scope: 'audio_data_retention',
              granted: v,
              timestamp: new Date().toISOString(),
            },
          });
        }}
      />

      <SettingRow
        icon="✅"
        label="Voice Processing Consent"
        description={state.consentGranted ? 'Consent granted' : 'Consent not granted — voice commands disabled'}
        rightElement={
          state.consentGranted ? (
            <PrimaryButton title="Revoke" onPress={handleRevokeConsent} variant="danger" style={styles.actionBtn} />
          ) : (
            <PrimaryButton
              title="Grant"
              onPress={() => {
                dispatch({ type: 'SET_CONSENT', granted: true });
                dispatch({
                  type: 'ADD_CONSENT_EVENT',
                  event: {
                    id: Date.now().toString(),
                    scope: 'voice_data_processing',
                    granted: true,
                    timestamp: new Date().toISOString(),
                  },
                });
              }}
              variant="primary"
              style={styles.actionBtn}
            />
          )
        }
      />

      <Card style={{ marginTop: Theme.spacing.sm, backgroundColor: Theme.colors.dangerMuted, borderColor: Theme.colors.danger }}>
        <PrimaryButton
          title="🗑️  Delete All My Data"
          onPress={handleDeleteAllData}
          variant="danger"
        />
        <Text style={styles.deleteNote}>
          Permanently removes all data from our servers (§9.4 cascade deletion).
        </Text>
      </Card>

      {/* ─── Accessibility Service ─────────────────────────────── */}
      <SectionHeader title="Accessibility Service" subtitle="ተደራሽነት አገልግሎት" />

      <SettingRow
        icon="♿"
        label="EchoGuide Accessibility Service"
        description="Controls third-party apps via gestures on your behalf"
        rightElement={
          <StatusBadge
            status={state.accessibilityServiceEnabled ? 'active' : 'inactive'}
            label={state.accessibilityServiceEnabled ? 'Enabled' : 'Disabled'}
          />
        }
      />

      {!state.accessibilityServiceEnabled && (
        <Card style={{ backgroundColor: Theme.colors.warningMuted, borderColor: Theme.colors.warning }}>
          <Text style={{ color: Theme.colors.warning, fontSize: Theme.typography.fontSizeSmall }}>
            ⚠️ The Accessibility Service is disabled. Go to Android Settings → Accessibility → EchoGuide to enable it.
          </Text>
        </Card>
      )}

      {/* ─── About ─────────────────────────────────────────────── */}
      <SectionHeader title="About" />

      <SettingRow
        icon="ℹ️"
        label="EchoGuide"
        description="Version 1.0.0 • Expo SDK 57"
        rightElement={<StatusBadge status="active" label="v1.0.0" />}
      />

      <SettingRow
        icon="📄"
        label="Privacy Policy"
        description="View our privacy policy and terms of service"
        rightElement={
          <Text style={{ color: Theme.colors.info, fontSize: 18 }}>→</Text>
        }
      />

      <View style={{ height: Theme.spacing.xxl }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    padding: Theme.spacing.md,
    paddingTop: Theme.spacing.xxl,
  },
  header: {
    fontSize: Theme.typography.fontSizeHeader,
    color: Theme.colors.text,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: Theme.typography.fontSizeSmall,
    color: Theme.colors.textMuted,
    marginBottom: Theme.spacing.sm,
  },
  langToggle: {
    flexDirection: 'row',
    gap: 4,
  },
  langBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  rateControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rateBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  rateValue: {
    color: Theme.colors.text,
    fontWeight: '700',
    fontSize: Theme.typography.fontSizeSmall,
    minWidth: 40,
    textAlign: 'center',
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  deleteNote: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.danger,
    textAlign: 'center',
    marginTop: Theme.spacing.sm,
  },
});
