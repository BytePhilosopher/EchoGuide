import React, { useState } from 'react';
import { Platform, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { House, ListChecks, Settings, User, type LucideIcon } from 'lucide-react-native';
import { Theme } from '../design/theme';
import { HomeScreen } from '../features/home/HomeScreen';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { HistoryScreen } from '../features/history/HistoryScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { AccountScreen } from '../features/account/AccountScreen';
import { useAppState } from '../state/AppStateContext';
import { t, type StringKey } from '../i18n/strings';

type TabName = 'home' | 'history' | 'settings' | 'account';

const TABS: { name: TabName; icon: LucideIcon; label: StringKey }[] = [
  { name: 'home', icon: House, label: 'tabHome' },
  { name: 'history', icon: ListChecks, label: 'tabHistory' },
  { name: 'settings', icon: Settings, label: 'tabSettings' },
  { name: 'account', icon: User, label: 'tabAccount' },
];

export const AppNavigator: React.FC = () => {
  const { state, dispatch } = useAppState();
  const [activeTab, setActiveTab] = useState<TabName>('home');
  const language = state.selectedLanguage;

  if (!state.onboardingComplete) {
    return (
      <OnboardingScreen onComplete={() => dispatch({ type: 'COMPLETE_ONBOARDING' })} />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.colors.ground} />

      <View style={styles.screen}>
        {activeTab === 'home' ? <HomeScreen /> : null}
        {activeTab === 'history' ? <HistoryScreen /> : null}
        {activeTab === 'settings' ? <SettingsScreen /> : null}
        {activeTab === 'account' ? <AccountScreen /> : null}
      </View>

      <View style={styles.tabBar} accessibilityRole="tablist">
        {TABS.map(({ name, icon: Icon, label }) => {
          const isActive = activeTab === name;
          return (
            <Pressable
              key={name}
              onPress={() => setActiveTab(name)}
              accessibilityRole="tab"
              accessibilityLabel={t(label, language)}
              accessibilityState={{ selected: isActive }}
              style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
            >

              <View style={[styles.tabMarker, isActive && styles.tabMarkerActive]} />
              <Icon
                size={22}
                color={isActive ? Theme.colors.strong : Theme.colors.muted}
                strokeWidth={isActive ? 2 : 1.5}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]} numberOfLines={1}>
                {t(label, language)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Theme.colors.ground,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  screen: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.colors.line,
    backgroundColor: Theme.colors.sunken,
    paddingBottom: Theme.spacing.sm,
  },
  tab: {
    flex: 1,
    minHeight: Theme.touchTarget,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  tabPressed: {
    opacity: 0.6,
  },
  tabMarker: {
    height: 2,
    width: 28,
    borderRadius: 1,
    backgroundColor: 'transparent',
    marginBottom: Theme.spacing.sm,
  },
  tabMarkerActive: {
    backgroundColor: Theme.colors.accent,
  },
  tabLabel: {
    ...Theme.type.caption,
    color: Theme.colors.muted,
    marginTop: 4,
  },
  tabLabelActive: {
    color: Theme.colors.strong,
  },
});
