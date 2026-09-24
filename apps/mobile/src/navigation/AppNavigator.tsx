import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, StatusBar } from 'react-native';
import { Theme } from '../design/theme';
import { HomeScreen } from '../features/home/HomeScreen';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { HistoryScreen } from '../features/history/HistoryScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { AccountScreen } from '../features/account/AccountScreen';
import { useAppState } from '../state/AppStateContext';

type TabName = 'Status' | 'History' | 'Settings' | 'Account';

export const AppNavigator: React.FC = () => {
  const { state } = useAppState();
  const [isOnboarded, setIsOnboarded] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<TabName>('Status');

  if (!isOnboarded && !state.onboardingComplete) {
    return <OnboardingScreen onComplete={() => setIsOnboarded(true)} />;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Status':
        return <HomeScreen />;
      case 'History':
        return <HistoryScreen />;
      case 'Settings':
        return <SettingsScreen />;
      case 'Account':
        return <AccountScreen />;
    }
  };

  const tabs: { key: TabName; label: string; icon: string }[] = [
    { key: 'Status', label: 'Hub', icon: '⚡' },
    { key: 'History', label: 'Outcomes', icon: '📜' },
    { key: 'Settings', label: 'Settings', icon: '⚙️' },
    { key: 'Account', label: 'Account', icon: '👤' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainContainer}>
        {renderTabContent()}

        {/* Futuristic Bottom Navigation Bar */}
        <View style={styles.tabBar} accessibilityLabel="Main Navigation Bar">
          {tabs.map((t) => {
            const isActive = activeTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
                onPress={() => setActiveTab(t.key)}
                accessibilityRole="tab"
                accessibilityLabel={`${t.label} Tab`}
                accessibilityState={{ selected: isActive }}
                activeOpacity={0.7}
              >
                <View style={[styles.tabIconContainer, isActive && styles.tabIconContainerActive]}>
                  <Text style={{ fontSize: 18, opacity: isActive ? 1 : 0.6 }}>{t.icon}</Text>
                </View>
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {t.label}
                </Text>
                {isActive && <View style={styles.activeGlowIndicator} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  mainContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  tabBar: {
    flexDirection: 'row',
    height: 72,
    backgroundColor: Theme.colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xs,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    position: 'relative',
  },
  tabItemActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.03)',
  },
  tabIconContainer: {
    marginBottom: 2,
  },
  tabIconContainerActive: {
    transform: [{ translateY: -2 }],
  },
  tabLabel: {
    fontSize: Theme.typography.fontSizeMicro,
    color: Theme.colors.textMuted,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: Theme.colors.primary,
    fontWeight: '800',
  },
  activeGlowIndicator: {
    position: 'absolute',
    top: 0,
    width: 32,
    height: 3,
    backgroundColor: Theme.colors.primary,
    borderRadius: 2,
    ...Theme.shadow.glow,
  },
});
