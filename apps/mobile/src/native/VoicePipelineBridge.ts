import {
  VoicePipelineNativeModule,
  type CommandOutcomeCode,
  type CommandOutcomeEvent,
  type LanguageCode,
  type PermissionStatus,
  type PipelineState,
  type PipelineStateEvent,
  type ServiceState,
} from '../../modules/voice-pipeline/src';

export type {
  CommandOutcomeCode,
  CommandOutcomeEvent,
  LanguageCode,
  PermissionStatus,
  PipelineState,
  PipelineStateEvent,
  ServiceState,
};

const CALL_TIMEOUT_MS = 3000;

function withTimeout<T>(work: Promise<T>, fallback: T): Promise<T> {
  const timeout = new Promise<T>((resolve) => setTimeout(() => resolve(fallback), CALL_TIMEOUT_MS));
  return Promise.race([work, timeout]).catch(() => fallback);
}

const UNAVAILABLE: ServiceState = {
  isWakeWordActive: false,
  isWakeWordReady: false,
  isAccessibilityEnabled: false,
  hasConsent: false,
  hasVoice: false,
  installId: '',
  currentLanguage: 'am-ET',
};

const DENIED: PermissionStatus = {
  microphoneGranted: false,
  accessibilityGranted: false,
  overlayGranted: false,
};

class VoicePipelineBridgeManager {
  readonly isNativeAvailable = VoicePipelineNativeModule != null;

  startListening(): void {
    VoicePipelineNativeModule?.startListening();
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
    return withTimeout(VoicePipelineNativeModule.setConsent(granted), false);
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

  async revokeConsent(): Promise<void> {
    if (!VoicePipelineNativeModule) return;
    await withTimeout(VoicePipelineNativeModule.revokeConsent(), undefined);
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
