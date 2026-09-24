import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Theme } from '../../design/theme';
import { VoicePipelineBridge } from '../../native/VoicePipelineBridge';

export const SettingsScreen: React.FC = () => {
  const [dataRetention, setDataRetention] = useState<boolean>(false);
  const [selectedLanguage, setSelectedLanguage] = useState<'am-ET' | 'en-US'>('am-ET');
  const [wakeWordActive, setWakeWordActive] = useState<boolean>(true);
  const [isRevoking, setIsRevoking] = useState<boolean>(false);

  useEffect(() => {
    VoicePipelineBridge.getServiceState().then((state) => {
      setSelectedLanguage(state.currentLanguage);
      setWakeWordActive(state.isWakeWordActive);
    });
  }, []);

  const handleLanguageChange = async (lang: 'am-ET' | 'en-US') => {
    setSelectedLanguage(lang);
    await VoicePipelineBridge.setLanguage(lang);
  };

  const handleRevokeConsent = () => {
    Alert.alert(
      'Revoke Voice Consent / ፈቃድ ሰርዝ',
      'Are you sure you want to revoke voice processing consent? The assistant will stop listening until consent is granted again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke Consent',
          style: 'destructive',
          onPress: async () => {
            setIsRevoking(true);
            await VoicePipelineBridge.revokeConsent();
            setIsRevoking(false);
            Alert.alert('Consent Revoked', 'Voice data processing consent has been revoked.');
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      accessibilityLabel="Accessibility Settings Screen"
    >
      <Text style={styles.header} accessibilityRole="header">
        Accessibility Settings
      </Text>
      <Text style={styles.headerSubtitle}>
        Configure voice engine, retention policies, and permissions (§5.3)
      </Text>

      {/* Language Preferences Card */}
      <View style={styles.card} accessibilityLabel="Language Preference Setting">
        <Text style={styles.cardTitle} accessibilityRole="header">
          Primary Voice Language
        </Text>
        <Text style={styles.cardSubtext}>
          Amharic uses Addis AI Cloud Engine; English uses Android On-Device TTS.
        </Text>

        <View style={styles.rowBtnContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, selectedLanguage === 'am-ET' && styles.segmentBtnActive]}
            onPress={() => handleLanguageChange('am-ET')}
            accessibilityRole="button"
            accessibilityLabel="Switch to Amharic Language"
            accessibilityState={{ selected: selectedLanguage === 'am-ET' }}
          >
            <Text style={styles.segmentText}>አማርኛ (Amharic)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, selectedLanguage === 'en-US' && styles.segmentBtnActive]}
            onPress={() => handleLanguageChange('en-US')}
            accessibilityRole="button"
            accessibilityLabel="Switch to English Language"
            accessibilityState={{ selected: selectedLanguage === 'en-US' }}
          >
            <Text style={styles.segmentText}>English (US)</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Opt-In Audio Retention Card (§4D, §10.1) */}
      <View style={styles.card} accessibilityLabel="Audio Data Retention Setting">
        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.label} accessibilityRole="header">
              Opt-In Audio Retention (§4D)
            </Text>
            <Text style={styles.subtext}>
              Default path persists zero transcripts or audio recordings. Enable only if you wish to help train Amharic models.
            </Text>
          </View>
          <Switch
            value={dataRetention}
            onValueChange={setDataRetention}
            trackColor={{ false: '#30363d', true: Theme.colors.primary }}
            accessibilityRole="switch"
            accessibilityLabel="Opt-In Audio Retention Switch"
            accessibilityState={{ checked: dataRetention }}
          />
        </View>
      </View>

      {/* Wake-Word & Pipeline Controls Card */}
      <View style={styles.card} accessibilityLabel="Wake Word Settings">
        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.label} accessibilityRole="header">
              Always-On Wake-Word (§6.1)
            </Text>
            <Text style={styles.subtext}>
              Kotlin background service monitors wake-word without opening the app window.
            </Text>
          </View>
          <Switch
            value={wakeWordActive}
            onValueChange={(val) => {
              setWakeWordActive(val);
              if (val) {
                VoicePipelineBridge.startListening();
              } else {
                VoicePipelineBridge.stopListening();
              }
            }}
            trackColor={{ false: '#30363d', true: Theme.colors.primary }}
            accessibilityRole="switch"
            accessibilityLabel="Always-On Wake Word Switch"
            accessibilityState={{ checked: wakeWordActive }}
          />
        </View>
      </View>

      {/* Data Revocation Card (§9.3, §10.1) */}
      <View style={styles.card} accessibilityLabel="Data Revocation Controls">
        <Text style={styles.label} accessibilityRole="header">
          Privacy & Consent Revocation
        </Text>
        <Text style={styles.subtext}>
          Revoking consent immediately halts voice capture and notifies backend auth services.
        </Text>

        <TouchableOpacity
          style={styles.dangerButton}
          onPress={handleRevokeConsent}
          disabled={isRevoking}
          accessibilityRole="button"
          accessibilityLabel="Revoke All Voice Processing Consent"
          accessibilityHint="Immediately stops voice capture and logs revocation event"
        >
          <Text style={styles.dangerButtonText}>
            {isRevoking ? 'Revoking...' : 'Revoke Voice Consent'}
          </Text>
        </TouchableOpacity>
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
    marginBottom: 4,
  },
  cardSubtext: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginBottom: 14,
  },
  rowBtnContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
  },
  segmentBtnActive: {
    borderColor: Theme.colors.primary,
    backgroundColor: 'rgba(35, 134, 54, 0.2)',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.text,
    marginBottom: 4,
  },
  subtext: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    lineHeight: 18,
  },
  dangerButton: {
    backgroundColor: 'rgba(248, 81, 73, 0.15)',
    borderWidth: 1,
    borderColor: Theme.colors.danger,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 14,
  },
  dangerButtonText: {
    color: Theme.colors.danger,
    fontSize: 14,
    fontWeight: 'bold',
  },
});
