import { TurboModuleRegistry } from 'react-native';
import type { Spec } from '../native/VoicePipelineBridgeSpec';
import catalog from './phrases.json';

export type PhraseLocale = 'am-ET' | 'en-US';
export type PhraseKey = keyof typeof catalog;

let currentLanguage: PhraseLocale = 'am-ET';

export function getPhrase(key: PhraseKey, language: PhraseLocale = currentLanguage): string {
  return catalog[key][language];
}

export function getPhraseCatalog(language: PhraseLocale = currentLanguage): Record<PhraseKey, string> {
  const phrases = {} as Record<PhraseKey, string>;
  (Object.keys(catalog) as PhraseKey[]).forEach((key) => {
    phrases[key] = catalog[key][language];
  });
  return phrases;
}

export async function setPhraseLanguage(language: PhraseLocale): Promise<boolean> {
  currentLanguage = language;
  const bridge = TurboModuleRegistry.get<Spec>('VoicePipelineBridge');
  if (!bridge) return true;
  return bridge.setLanguage(language);
}

export function getPhraseLanguage(): PhraseLocale {
  return currentLanguage;
}
