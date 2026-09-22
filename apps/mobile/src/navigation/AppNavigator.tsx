import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Theme } from '../design/theme';
import { useAppState } from '../state/AppStateContext';

// Screens
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { HistoryScreen } from '../features/history/HistoryScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { AccountScreen } from '../features/account/AccountScreen';

/* ─── Navigation Theme ────────────────────────────────────────── */
const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: Theme.colors.primary,
    background: Theme.colors.background,
    card: Theme.colors.cardBackground,
    text: Theme.colors.text,
    border: Theme.colors.border,
    notification: Theme.colors.danger,
  },
};

/* ─── Tab Icon Component ──────────────────────────────────────── */
const TabIcon: React.FC<{ icon: string; label: string; focused: boolean }> = ({
  icon,
  label,
  focused,
}) => (
  <View style={tabStyles.iconContainer}>
    <Text style={[tabStyles.icon, focused && tabStyles.iconFocused]}>{icon}</Text>
    <Text style={[tabStyles.label, focused && tabStyles.labelFocused]}>{label}</Text>
  </View>
);

const tabStyles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  icon: {
    fontSize: 22,
    opacity: 0.5,
  },
  iconFocused: {
    opacity: 1,
  },
  label: {
    fontSize: 10,
    color: Theme.colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  labelFocused: {
    color: Theme.colors.primary,
  },
});

/* ─── Stacks & Tabs ───────────────────────────────────────────── */
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs: React.FC = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: Theme.colors.cardBackground,
        borderTopColor: Theme.colors.border,
        borderTopWidth: 1,
        height: 64,
        paddingBottom: 8,
      },
      tabBarShowLabel: false,
      tabBarActiveTintColor: Theme.colors.primary,
      tabBarInactiveTintColor: Theme.colors.textMuted,
    }}
  >
    <Tab.Screen
      name="Home"
      component={HomeScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon icon="🏠" label="Home" focused={focused} />,
      }}
    />
    <Tab.Screen
      name="History"
      component={HistoryScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon icon="📋" label="History" focused={focused} />,
      }}
    />
    <Tab.Screen
      name="Settings"
      component={SettingsScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon icon="⚙️" label="Settings" focused={focused} />,
      }}
    />
    <Tab.Screen
      name="Account"
      component={AccountScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon icon="👤" label="Account" focused={focused} />,
      }}
    />
  </Tab.Navigator>
);

/* ─── Root Navigator ──────────────────────────────────────────── */
export const AppNavigator: React.FC = () => {
  const { state } = useAppState();

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!state.onboardingComplete ? (
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ animationTypeForReplace: 'push' }}
          />
        ) : (
          <Stack.Screen
            name="Main"
            component={MainTabs}
            options={{ animationTypeForReplace: 'pop' }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
