import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppStateProvider } from './src/state/AppStateContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ConfirmationOverlay } from './src/features/confirmation/ConfirmationOverlay';
import { useCommandOutcomes } from './src/native/useCommandOutcomes';

const PipelineHost: React.FC = () => {
  useCommandOutcomes();
  return (
    <>
      <AppNavigator />
      <ConfirmationOverlay />
    </>
  );
};

export default function App() {
  return (
    <AppStateProvider>
      <StatusBar style="light" />
      <PipelineHost />
    </AppStateProvider>
  );
}
