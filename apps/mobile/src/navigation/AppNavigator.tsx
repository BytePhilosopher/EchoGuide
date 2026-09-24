import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { Theme } from '../design/theme';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { HistoryScreen } from '../features/history/HistoryScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { AccountScreen } from '../features/account/AccountScreen';
import { VoicePipelineBridge } from '../native/VoicePipelineBridge';

type TabName = 'Status' | 'History' | 'Settings' | 'Account';

export const AppNavigator: React.FC = () => {
  const [isOnboarded, setIsOnboarded] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<TabName>('Status');
  const [isWakeWordActive, setIsWakeWordActive] = useState<boolean>(true);

  if (!isOnboarded) {
    return <OnboardingScreen onComplete={() => setIsOnboarded(true)} />;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Status':
        return (
          <View style={styles.statusContainer} accessibilityLabel="Pipeline Service Status Screen">
            <View style={styles.statusHeader}>
              <Text style={styles.statusTitle} accessibilityRole="header">
                EchoGuide Pipeline Status
              </Text>
              <Text style={styles.statusSub}>
                Bilingual voice control running in Kotlin Native (§5.1)
              </Text>
            </View>

            <View style={styles.statusCard}>
              <Text style={styles.cardHeader} accessibilityRole="header">
                Native Service Indicator
              </Text>
              <View style={styles.indicatorRow}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: isWakeWordActive ? Theme.colors.primaryHover : Theme.colors.danger },
                  ]}
                />
                <Text style={styles.indicatorText}>
                  {isWakeWordActive ? 'Wake-Word Engine Listening (16 kHz PCM)' : 'Voice Engine Stopped'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  if (isWakeWordActive) {
                    VoicePipelineBridge.stopListening();
                    setIsWakeWordActive(false);
                  } else {
                    VoicePipelineBridge.startListening();
                    setIsWakeWordActive(true);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={isWakeWordActive ? 'Pause Wake-Word Engine' : 'Resume Wake-Word Engine'}
              >
                <Text style={styles.actionButtonText}>
                  {isWakeWordActive ? 'Pause Listening' : 'Start Listening'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case 'History':
        return <HistoryScreen />;
      case 'Settings':
        return <SettingsScreen />;
      case 'Account':
        return <AccountScreen />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainContainer}>
        {renderTabContent()}

        {/* Bottom Navigation Bar */}
        <View style={styles.tabBar} accessibilityLabel="Main Navigation Bar">
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'Status' && styles.tabItemActive]}
            onPress={() => setActiveTab('Status')}
            accessibilityRole="tab"
            accessibilityLabel="Pipeline Status Tab"
            accessibilityState={{ selected: activeTab === 'Status' }}
          >
            <Text style={[styles.tabLabel, activeTab === 'Status' && styles.tabLabelActive]}>
              Status
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'History' && styles.tabItemActive]}
            onPress={() => setActiveTab('History')}
            accessibilityRole="tab"
            accessibilityLabel="Outcomes History Tab"
            accessibilityState={{ selected: activeTab === 'History' }}
          >
            <Text style={[styles.tabLabel, activeTab === 'History' && styles.tabLabelActive]}>
              History
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'Settings' && styles.tabItemActive]}
            onPress={() => setActiveTab('Settings')}
            accessibilityRole="tab"
            accessibilityLabel="Accessibility Settings Tab"
            accessibilityState={{ selected: activeTab === 'Settings' }}
          >
            <Text style={[styles.tabLabel, activeTab === 'Settings' && styles.tabLabelActive]}>
              Settings
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'Account' && styles.tabItemActive]}
            onPress={() => setActiveTab('Account')}
            accessibilityRole="tab"
            accessibilityLabel="User Account Tab"
            accessibilityState={{ selected: activeTab === 'Account' }}
          >
            <Text style={[styles.tabLabel, activeTab === 'Account' && styles.tabLabelActive]}>
              Account
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  mainContainer: {
    flex: 1,
    justify: 'space-between',
  },
  statusContainer: {
    flex: 1,
    padding: 20,
  },
  statusHeader: {
    marginBottom: 20,
  },
  statusTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: Theme.colors.text,
    marginBottom: 4,
  },
  statusSub: {
    fontSize: 14,
    color: Theme.colors.textMuted,
  },
  statusCard: {
    backgroundColor: Theme.colors.cardBackground,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.text,
    marginBottom: 14,
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  indicatorText: {
    fontSize: 14,
    color: Theme.colors.text,
    fontWeight: '500',
  },
  actionButton: {
    backgroundColor: Theme.colors.secondary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tabBar: {
    flexDirection: 'row',
    height: 64,
    backgroundColor: Theme.colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabItemActive: {
    borderTopWidth: 2,
    borderTopColor: Theme.colors.primary,
  },
  tabLabel: {
    fontSize: 13,
    color: Theme.colors.textMuted,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: Theme.colors.primaryHover,
    fontWeight: 'bold',
  },
});
