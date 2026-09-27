import { PermissionsAndroid, Platform } from 'react-native';
import {
  VoicePipelineNativeModule,
  type CommandOutcomeCode,
  type CommandOutcomeEvent,
  type Entitlement,
  type LanguageCode,
  type PermissionStatus,
  type PipelineState,
  type PipelineStateEvent,
  type ServiceState,
} from '../../modules/voice-pipeline/src';

export type {
  CommandOutcomeCode,
  CommandOutcomeEvent,
  Entitlement,
  LanguageCode,
  PermissionStatus,
  PipelineState,
  PipelineStateEvent,
  ServiceState,
};

const CALL_TIMEOUT_MS = 3000;
// Calls that wait on the server: registration plus the request, each with its own native timeout.
const NETWORK_TIMEOUT_MS = 30000;

function withTimeout<T>(work: Promise<T>, fallback: T, timeoutMs = CALL_TIMEOUT_MS): Promise<T> {
  const timeout = new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs));
  return Promise.race([work, timeout]).catch(() => fallback);
}

const UNAVAILABLE: ServiceState = {
  isWakeWordActive: false,
  isWakeWordReady: false,
  isAccessibilityEnabled: false,
  hasConsent: false,
  hasVoice: false,
  wakeWord: 'echo',
  installId: '',
  currentLanguage: 'am-ET',
  modelProgress: null,
};

const DENIED: PermissionStatus = {
  microphoneGranted: false,
  accessibilityGranted: false,
  overlayGranted: false,
};

class VoicePipelineBridgeManager {
  readonly isNativeAvailable = VoicePipelineNativeModule != null;

  startListening(): boolean {
    return VoicePipelineNativeModule?.startListening() ?? false;
  }

  /** Asks for the microphone (and, on Android 13+, the listening notification). True if the mic is granted. */
  async requestMicrophone(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    const wanted = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
    if (Platform.Version >= 33) wanted.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    const results = await PermissionsAndroid.requestMultiple(wanted);
    return results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
  }

  stopListening(): void {
    VoicePipelineNativeModule?.stopListening();
  }

  triggerListening(): void {
    VoicePipelineNativeModule?.triggerListening();
  }

  async confirmPending(confirmed: boolean): Promise<void> {
    if (!VoicePipelineNativeModule) return;
    await withTimeout(VoicePipelineNativeModule.confirmPending(confirmed), undefined);
  }

  async setConsent(granted: boolean): Promise<boolean> {
    if (!VoicePipelineNativeModule) return false;
    return withTimeout(VoicePipelineNativeModule.setConsent(granted), false, NETWORK_TIMEOUT_MS);
  }

  async setWakeWord(phrase: string): Promise<string> {
    if (!VoicePipelineNativeModule) return phrase;
    return withTimeout(VoicePipelineNativeModule.setWakeWord(phrase), phrase);
  }

  async registerDevice(): Promise<void> {
    if (!VoicePipelineNativeModule) return;
    await withTimeout(VoicePipelineNativeModule.registerDevice(), undefined);
  }

  async prepareWakeWord(): Promise<void> {
    if (!VoicePipelineNativeModule) return;
    await withTimeout(VoicePipelineNativeModule.prepareWakeWord(), undefined);
  }

  async openAccessibilitySettings(): Promise<boolean> {
    if (!VoicePipelineNativeModule) return false;
    return withTimeout(VoicePipelineNativeModule.openAccessibilitySettings(), false);
  }

  async openVoiceSettings(): Promise<boolean> {
    if (!VoicePipelineNativeModule) return false;
    return withTimeout(VoicePipelineNativeModule.openVoiceSettings(), false);
  }

  async setLanguage(languageCode: LanguageCode): Promise<boolean> {
    if (!VoicePipelineNativeModule) return false;
    return withTimeout(VoicePipelineNativeModule.setLanguage(languageCode), false);
  }

  async revokeConsent(): Promise<boolean> {
    if (!VoicePipelineNativeModule) return false;
    return withTimeout(VoicePipelineNativeModule.revokeConsent(), false, NETWORK_TIMEOUT_MS);
  }

  async setAudioRetention(optIn: boolean): Promise<boolean> {
    if (!VoicePipelineNativeModule) return false;
    return withTimeout(VoicePipelineNativeModule.setAudioRetention(optIn), false, NETWORK_TIMEOUT_MS);
  }

  async getEntitlement(): Promise<Entitlement | null> {
    if (!VoicePipelineNativeModule) return null;
    return withTimeout(VoicePipelineNativeModule.getEntitlement(), null, NETWORK_TIMEOUT_MS);
  }

  async deleteUserData(): Promise<boolean> {
    if (!VoicePipelineNativeModule) return false;
    return withTimeout(VoicePipelineNativeModule.deleteUserData(), false, NETWORK_TIMEOUT_MS);
  }

  async getServiceState(): Promise<ServiceState> {
    if (!VoicePipelineNativeModule) return UNAVAILABLE;
    return withTimeout(VoicePipelineNativeModule.getServiceState(), UNAVAILABLE);
  }

  async getPermissionStatus(): Promise<PermissionStatus> {
    if (!VoicePipelineNativeModule) return DENIED;
    return withTimeout(VoicePipelineNativeModule.getPermissionStatus(), DENIED);
  }

  subscribeToOutcomes(listener: (event: CommandOutcomeEvent) => void): () => void {
    const subscription = VoicePipelineNativeModule?.addListener('onLastCommandOutcome', listener);
    return () => subscription?.remove();
  }

  subscribeToState(listener: (event: PipelineStateEvent) => void): () => void {
    const subscription = VoicePipelineNativeModule?.addListener('onPipelineState', listener);
    return () => subscription?.remove();
  }
}

export const VoicePipelineBridge = new VoicePipelineBridgeManager();
