import { useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { VoicePipelineBridge } from './VoicePipelineBridge';
import { useAppState } from '../state/AppStateContext';

export function useCommandOutcomes(): void {
  const { dispatch } = useAppState();

  useEffect(() => {
    const unsubscribe = VoicePipelineBridge.subscribeToOutcomes((event) => {
      Haptics.notificationAsync(
        event.outcome === 'done'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      ).catch(() => undefined);
      dispatch({
        type: 'ADD_COMMAND_OUTCOME',
        outcome: {
          id: event.id,
          timestamp: event.timestamp,
          outcome: event.outcome,
          durationMs: event.durationMs,
        },
      });
    });
    return unsubscribe;
  }, [dispatch]);
}
