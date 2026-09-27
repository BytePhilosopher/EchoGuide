import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider } from './src/state/AppStateContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ConfirmationOverlay } from './src/features/confirmation/ConfirmationOverlay';
import { useCommandOutcomes } from './src/native/useCommandOutcomes';
import { VoicePipelineBridge } from './src/native/VoicePipelineBridge';
import { useAppState } from './src/state/AppStateContext';

const PipelineHost: React.FC = () => {
  useCommandOutcomes();
  const { state } = useAppState();

  // Fetches the wake word model if an earlier launch could not (offline, app killed mid-download).
  useEffect(() => {
    if (state.consentGranted) VoicePipelineBridge.prepareWakeWord();
  }, [state.consentGranted]);
  return (
    <>
      <AppNavigator />
      <ConfirmationOverlay />
    </>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <StatusBar style="light" />
        <PipelineHost />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
