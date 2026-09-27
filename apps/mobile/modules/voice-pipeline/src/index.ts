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
  wakeWord: string;
  installId: string;
  currentLanguage: LanguageCode;
  /** 0..1 while the wake word model is being set up on first launch, null otherwise. */
  modelProgress: number | null;
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
  /** Set while CONFIRMING asks to allow an app, rather than to run a plan. */
  grantFor: string | null;
  modelProgress: number | null;
}

export type SubscriptionState =
  | 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'CANCELED' | 'INACTIVE' | 'EXPIRED' | 'NONE' | 'UNKNOWN';

export interface Entitlement {
  isEnforced: boolean;
  state: SubscriptionState;
  renewsAt: string | null;
  commandQuota: number | null;
  commandsUsed: number | null;
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
  startListening(): boolean;
  stopListening(): void;
  triggerListening(): void;
  confirmPending(confirmed: boolean): Promise<void>;
  setConsent(granted: boolean): Promise<boolean>;
  prepareWakeWord(): Promise<void>;
  registerDevice(): Promise<void>;
  setWakeWord(phrase: string): Promise<string>;
  openAccessibilitySettings(): Promise<boolean>;
  openVoiceSettings(): Promise<boolean>;
  setLanguage(languageCode: LanguageCode): Promise<boolean>;
  revokeConsent(): Promise<boolean>;
  setAudioRetention(optIn: boolean): Promise<boolean>;
  getEntitlement(): Promise<Entitlement | null>;
  deleteUserData(): Promise<boolean>;
  getServiceState(): Promise<ServiceState>;
  getPermissionStatus(): Promise<PermissionStatus>;
}

export const VoicePipelineNativeModule =
  requireOptionalNativeModule<VoicePipelineNative>('VoicePipeline');
