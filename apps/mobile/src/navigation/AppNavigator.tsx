import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  // Android draws edge to edge, so the status bar and the system navigation buttons overlap the app.
  const insets = useSafeAreaInsets();

  if (!state.onboardingComplete) {
    return (
      <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <OnboardingScreen onComplete={() => dispatch({ type: 'COMPLETE_ONBOARDING' })} />
      </View>
    );
  }

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <View style={styles.screen}>
        {activeTab === 'home' ? <HomeScreen /> : null}
        {activeTab === 'history' ? <HistoryScreen /> : null}
        {activeTab === 'settings' ? <SettingsScreen /> : null}
        {activeTab === 'account' ? <AccountScreen /> : null}
      </View>

      <View
        style={[styles.tabBar, { paddingBottom: insets.bottom + Theme.spacing.sm }]}
        accessibilityRole="tablist"
      >
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
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Theme.colors.ground,
  },
  screen: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.colors.line,
    backgroundColor: Theme.colors.sunken,
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
