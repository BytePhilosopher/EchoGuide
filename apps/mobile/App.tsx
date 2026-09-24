import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppStateProvider } from './src/state/AppStateContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    <AppStateProvider>
      <StatusBar style="light" />
      <AppNavigator />
    </AppStateProvider>
  );
}
