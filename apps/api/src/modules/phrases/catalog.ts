export const PHRASE_KEYS = [
  'ACK',
  'STILL_WORKING',
  'RETRY',
  'CONFIRM',
  'ERR_NETWORK',
  'ERR_TOO_SLOW',
  'ERR_REJECTED',
  'ERR_BILLING',
] as const;

export type PhraseKey = (typeof PHRASE_KEYS)[number];
export type PhraseLocale = 'am-ET' | 'en-US';

export const PHRASES: Record<PhraseKey, Record<PhraseLocale, string>> = {
  ACK: {
    'en-US': 'Got it.',
    'am-ET': 'ገባኝ።',
  },
  STILL_WORKING: {
    'en-US': 'Still working',
    'am-ET': 'እየሰራሁ ነው',
  },
  RETRY: {
    'en-US': 'Could you say that again?',
    'am-ET': 'እባክዎ እንደገና ይበሉ።',
  },
  CONFIRM: {
    'en-US': 'Should I go ahead?',
    'am-ET': 'ልቀጥል?',
  },
  ERR_NETWORK: {
    'en-US': "I can't reach the network right now",
    'am-ET': 'አሁን መረብ ላይ መድረስ አልቻልኩም',
  },
  ERR_TOO_SLOW: {
    'en-US': 'That took too long. Try again',
    'am-ET': 'ረዘመ። እንደገና ይሞክሩ',
  },
  ERR_REJECTED: {
    'en-US': 'I cannot do that',
    'am-ET': 'ያንን ማድረግ አልችልም',
  },
  ERR_BILLING: {
    'en-US': 'Your plan cannot run this command right now',
    'am-ET': 'እቅድዎ ይህን ትእዛዝ አሁን ማስኬድ አይችልም',
  },
};

export function getPhraseCatalog(language: PhraseLocale): {
  language: PhraseLocale;
  phrases: Record<PhraseKey, string>;
} {
  const phrases = {} as Record<PhraseKey, string>;
  for (const key of PHRASE_KEYS) {
    phrases[key] = PHRASES[key][language];
  }
  return { language, phrases };
}
