import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Theme } from '../../design/theme';

export const AccountScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>User Account</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Device Identity</Text>
        <Text style={styles.value}>Hashed Phone ID (§10.4)</Text>
        <Text style={styles.label}>Subscription Plan</Text>
        <Text style={styles.value}>EchoGuide Accessibility Pro</Text>
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
  card: {
    backgroundColor: Theme.colors.cardBackground,
    padding: Theme.spacing.md,
    borderRadius: 8,
    borderColor: Theme.colors.border,
    borderWidth: 1,
  },
  label: {
    color: Theme.colors.textMuted,
    fontSize: Theme.typography.fontSizeCaption,
    marginTop: 8,
  },
  value: {
    color: Theme.colors.text,
    fontSize: Theme.typography.fontSizeBody,
    fontWeight: '600',
  },
});
