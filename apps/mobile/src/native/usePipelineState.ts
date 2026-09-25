import { useEffect, useState } from 'react';
import { AppState as RNAppState } from 'react-native';
import { VoicePipelineBridge, type PipelineState } from './VoicePipelineBridge';

export interface PipelineStatus {
  available: boolean;
  isListening: boolean;
  state: PipelineState;
  wakeWordAvailable: boolean;
  accessibilityEnabled: boolean;
  hasVoice: boolean;
}

export const isAwaitingConfirmation = (status: PipelineStatus): boolean =>
  status.state === 'CONFIRMING';

const INITIAL: PipelineStatus = {
  available: VoicePipelineBridge.isNativeAvailable,
  isListening: false,
  state: 'IDLE',
  wakeWordAvailable: false,
  accessibilityEnabled: false,
  hasVoice: true,
};

export function usePipelineState(): PipelineStatus {
  const [status, setStatus] = useState<PipelineStatus>(INITIAL);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const service = await VoicePipelineBridge.getServiceState();
      if (cancelled) return;
      setStatus((previous) => ({
        ...previous,
        available: VoicePipelineBridge.isNativeAvailable,
        isListening: service.isWakeWordActive,
        wakeWordAvailable: service.isWakeWordReady,
        accessibilityEnabled: service.isAccessibilityEnabled,
        hasVoice: service.hasVoice,
      }));
    };

    refresh();

    const unsubscribe = VoicePipelineBridge.subscribeToState((event) => {
      setStatus((previous) => ({
        ...previous,
        available: true,
        isListening: event.isListening,
        state: event.state,
        wakeWordAvailable: event.wakeWordAvailable,
        accessibilityEnabled: event.accessibilityEnabled,
      }));
    });

    const appStateSub = RNAppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });

    return () => {
      cancelled = true;
      unsubscribe();
      appStateSub.remove();
    };
  }, []);

  return status;
}
