import { requireOptionalNativeModule } from 'expo';

export type LanguageCode = 'am-ET' | 'en-US';

export type PipelineState =
  | 'IDLE' | 'CAPTURING' | 'TRANSCRIBING' | 'PLANNING' | 'CONFIRMING' | 'EXECUTING'
  | 'DISCARDED' | 'REPROMPTING' | 'FALLBACK' | 'BLOCKED' | 'CANCELLED' | 'DONE' | 'FAILED';

export type CommandOutcomeCode = 'done' | 'failed' | 'rejected' | 'blocked' | 'cancelled';

export interface ServiceState {
  isWakeWordActive: boolean;
  isWakeWordReady: boolean;
  isAccessibilityEnabled: boolean;
  hasConsent: boolean;
  hasVoice: boolean;
  installId: string;
  currentLanguage: LanguageCode;
}

export interface PermissionStatus {
  microphoneGranted: boolean;
  accessibilityGranted: boolean;
  overlayGranted: boolean;
}

export interface CommandOutcomeEvent {
  id: string;
  outcome: CommandOutcomeCode;
  durationMs: number;
  timestamp: string;
}

export interface PipelineStateEvent {
  state: PipelineState;
  isListening: boolean;
  wakeWordAvailable: boolean;
  accessibilityEnabled: boolean;
}

interface EventSubscription {
  remove(): void;
}

interface VoicePipelineNative {
  addListener(
    event: 'onLastCommandOutcome',
    listener: (payload: CommandOutcomeEvent) => void,
  ): EventSubscription;
  addListener(
    event: 'onPipelineState',
    listener: (payload: PipelineStateEvent) => void,
  ): EventSubscription;
  startListening(): void;
  stopListening(): void;
  triggerListening(): void;
  confirmPending(confirmed: boolean): Promise<void>;
  setConsent(granted: boolean): Promise<boolean>;
  prepareWakeWord(): Promise<void>;
  registerDevice(): Promise<void>;
  openAccessibilitySettings(): Promise<boolean>;
  openVoiceSettings(): Promise<boolean>;
  setLanguage(languageCode: LanguageCode): Promise<boolean>;
  revokeConsent(): Promise<void>;
  getServiceState(): Promise<ServiceState>;
  getPermissionStatus(): Promise<PermissionStatus>;
}

export const VoicePipelineNativeModule =
  requireOptionalNativeModule<VoicePipelineNative>('VoicePipeline');
