import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppStateProvider } from './src/state/AppStateContext';
import { AppNavigator } from './src/navigation/AppNavigator';

/**
 * Root Application Entry Point
 * Wraps AppStateProvider (React Context + AsyncStorage)
 * around the conditional navigation system.
 *
 * §5.1 Compliance: No pipeline logic in this layer.
 * Audio/VAD/Executor live entirely in Kotlin native.
 */
export default function App() {
  return (
    <AppStateProvider>
      <StatusBar style="light" />
      <AppNavigator />
    </AppStateProvider>
  );
}
