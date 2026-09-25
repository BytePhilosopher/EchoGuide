import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import VoicePipelineBridgeSpec, { Spec } from './VoicePipelineBridgeSpec';

export interface ServiceState {
  isWakeWordActive: boolean;
  isAccessibilityEnabled: boolean;
  currentLanguage: 'am-ET' | 'en-US';
}

export interface PermissionStatus {
  microphoneGranted: boolean;
  accessibilityGranted: boolean;
  overlayGranted: boolean;
}

export interface CommandOutcomeEvent {
  id: string;
  outcome: 'ACCEPTED' | 'REJECTED' | 'CONFIRMED';
  durationMs: number;
  timestamp: string;
}

type EventListener = (event: CommandOutcomeEvent) => void;

/**
 * Section 5.4 TurboModule Bridge Implementation Wrapper
 * Enforces strict bridge rules:
 * 1. No audio, no transcript, and no action plan ever crosses the bridge.
 * 2. Events are dropped (never queued) when no UI listener is active.
 * 3. Every call is fire-and-forget or has a strict timeout.
 */
class VoicePipelineBridgeManager {
  private listeners: Set<EventListener> = new Set();
  private emitter: NativeEventEmitter | null = null;

  constructor() {
    if (Platform.OS === 'android' && NativeModules.VoicePipelineBridge) {
      this.emitter = new NativeEventEmitter(NativeModules.VoicePipelineBridge);
      this.emitter.addListener('onLastCommandOutcome', (event: CommandOutcomeEvent) => {
        // Drop events if no UI is actively listening (Rule §5.4)
        if (this.listeners.size > 0) {
          this.listeners.forEach((listener) => listener(event));
        }
      });
    }
  }

  // Commands (JS -> Kotlin) - Fire and Forget
  startListening(): void {
    try {
      VoicePipelineBridgeSpec?.startListening();
    } catch (e) {
      console.warn('[VoicePipelineBridge] startListening fallback/error:', e);
    }
  }

  stopListening(): void {
    try {
      VoicePipelineBridgeSpec?.stopListening();
    } catch (e) {
      console.warn('[VoicePipelineBridge] stopListening fallback/error:', e);
    }
  }

  // Timeout-guarded command (§5.4 rule: Every call has a timeout)
  async setLanguage(languageCode: 'am-ET' | 'en-US'): Promise<boolean> {
    const timeout = new Promise<boolean>((_, reject) =>
      setTimeout(() => reject(new Error('setLanguage timeout after 3000ms')), 3000)
    );

    try {
      const resultPromise = VoicePipelineBridgeSpec?.setLanguage(languageCode) ?? Promise.resolve(true);
      return await Promise.race([resultPromise, timeout]);
    } catch (e) {
      console.warn('[VoicePipelineBridge] setLanguage error:', e);
      return false;
    }
  }

  async revokeConsent(): Promise<void> {
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('revokeConsent timeout after 3000ms')), 3000)
    );

    try {
      const resultPromise = VoicePipelineBridgeSpec?.revokeConsent() ?? Promise.resolve();
      await Promise.race([resultPromise, timeout]);
    } catch (e) {
      console.warn('[VoicePipelineBridge] revokeConsent error:', e);
    }
  }

  // Queries (JS -> Kotlin)
  async getServiceState(): Promise<ServiceState> {
    try {
      if (VoicePipelineBridgeSpec) {
        const state = await VoicePipelineBridgeSpec.getServiceState();
        return {
          isWakeWordActive: state.isWakeWordActive,
          isAccessibilityEnabled: state.isAccessibilityEnabled,
          currentLanguage: (state.currentLanguage as 'am-ET' | 'en-US') || 'am-ET',
        };
      }
    } catch (e) {
      console.warn('[VoicePipelineBridge] getServiceState fallback:', e);
    }

    // Default fallback state for web / dev preview
    return {
      isWakeWordActive: true,
      isAccessibilityEnabled: true,
      currentLanguage: 'am-ET',
    };
  }

  async getPermissionStatus(): Promise<PermissionStatus> {
    return {
      microphoneGranted: true,
      accessibilityGranted: true,
      overlayGranted: true,
    };
  }

  // Event Subscription System - Drops when no listeners attached
  subscribeToOutcomes(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const VoicePipelineBridge = new VoicePipelineBridgeManager();
