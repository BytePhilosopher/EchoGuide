import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { Theme } from '../../design/theme';

export const SettingsScreen: React.FC = () => {
  const [dataRetention, setDataRetention] = React.useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Accessibility Settings</Text>

      <View style={styles.settingRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Opt-In Audio Retention (§D4)</Text>
          <Text style={styles.subtext}>Default path persists zero transcripts or audio recordings.</Text>
        </View>
        <Switch
          value={dataRetention}
          onValueChange={setDataRetention}
          trackColor={{ false: '#30363d', true: Theme.colors.primary }}
        />
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
  header: {
    fontSize: Theme.typography.fontSizeHeader,
    color: Theme.colors.text,
    fontWeight: 'bold',
    marginBottom: Theme.spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.cardBackground,
    padding: Theme.spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  label: {
    fontSize: Theme.typography.fontSizeBody,
    color: Theme.colors.text,
    fontWeight: '600',
  },
  subtext: {
    fontSize: Theme.typography.fontSizeCaption,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
});
