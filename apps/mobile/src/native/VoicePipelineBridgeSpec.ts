import { TurboModule, TurboModuleRegistry } from 'react-native';

/**
 * Section 5.4 TurboModule Bridge Contract
 * Direct connection between React Native JS runtime and Kotlin Native Pipeline.
 * STRICT RULE: No raw audio, no transcript, and no action plan details cross this bridge.
 */
export interface Spec extends TurboModule {
  // Commands (JS -> Kotlin)
  startListening(): void;
  stopListening(): void;
  setLanguage(languageCode: 'am-ET' | 'en-US'): Promise<boolean>;
  revokeConsent(): Promise<void>;

  // Queries (JS -> Kotlin)
  getServiceState(): Promise<{
    isWakeWordActive: boolean;
    isAccessibilityEnabled: boolean;
    currentLanguage: string;
  }>;
}

export default TurboModuleRegistry.get<Spec>('VoicePipelineBridge');
