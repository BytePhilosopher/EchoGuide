import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Theme } from '../../design/theme';
import { setPhraseLanguage } from '../../speech/phrases';

export const OnboardingScreen: React.FC = () => {
  const [selectedLang, setSelectedLang] = useState<'am-ET' | 'en-US'>('am-ET');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>EchoGuide Accessibility</Text>
      <Text style={styles.subtitle}>Bilingual Voice Control for Android</Text>

      {/* Main Context Architecture Image Preview */}
      <View style={styles.imageCard}>
        <Image
          source={require('../../../assets/system_architecture_diagram.png')}
          style={styles.archImage}
          resizeMode="contain"
          accessibilityLabel="EchoGuide System Architecture Context Diagram"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Choose Primary Language</Text>
        <Text style={styles.cardSubtitle}>ቋንቋ ይምረጡ / Choose Language</Text>

        <TouchableOpacity
          style={[styles.langButton, selectedLang === 'am-ET' && styles.langButtonActive]}
          onPress={() => {
            setSelectedLang('am-ET');
            void setPhraseLanguage('am-ET');
          }}
          accessibilityRole="button"
          accessibilityLabel="Select Amharic Language"
        >
          <Text style={styles.langText}>አማርኛ (Amharic - Addis AI Engine)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.langButton, selectedLang === 'en-US' && styles.langButtonActive]}
          onPress={() => {
            setSelectedLang('en-US');
            void setPhraseLanguage('en-US');
          }}
          accessibilityRole="button"
          accessibilityLabel="Select English Language"
        >
          <Text style={styles.langText}>English (On-Device TTS)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    padding: Theme.spacing.md,
  },
  title: {
    fontSize: Theme.typography.fontSizeHeader,
    fontWeight: 'bold',
    color: Theme.colors.text,
    textAlign: 'center',
    marginTop: Theme.spacing.lg,
  },
  subtitle: {
    fontSize: Theme.typography.fontSizeSubheader,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: Theme.spacing.md,
  },
  imageCard: {
    backgroundColor: Theme.colors.cardBackground,
    borderRadius: 12,
    padding: Theme.spacing.sm,
    borderColor: Theme.colors.border,
    borderWidth: 1,
    height: 180,
    marginBottom: Theme.spacing.md,
  },
  archImage: {
    width: '100%',
    height: '100%',
  },
  card: {
    backgroundColor: Theme.colors.cardBackground,
    padding: Theme.spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  cardTitle: {
    fontSize: Theme.typography.fontSizeSubheader,
    fontWeight: '600',
    color: Theme.colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    marginBottom: Theme.spacing.md,
  },
  langButton: {
    backgroundColor: '#21262d',
    padding: Theme.spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: Theme.spacing.sm,
  },
  langButtonActive: {
    borderColor: Theme.colors.primary,
    backgroundColor: '#1b4721',
  },
  langText: {
    color: Theme.colors.text,
    fontSize: Theme.typography.fontSizeBody,
    fontWeight: '500',
  },
});
