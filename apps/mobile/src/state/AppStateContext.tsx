import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CommandOutcome {
  id: string;
  timestamp: string;
  outcome: 'done' | 'failed' | 'rejected' | 'blocked' | 'cancelled';
  durationMs: number;
  stageTiming?: {
    sttMs?: number;
    llmMs?: number;
    execMs?: number;
  };
}

export interface ConsentEvent {
  id: string;
  scope: string;
  granted: boolean;
  timestamp: string;
}

export interface AppState {
  onboardingComplete: boolean;
  selectedLanguage: 'am-ET' | 'en-US';
  consentGranted: boolean;
  dataRetentionOptIn: boolean;
  speechRate: number;
  wakeWord: string;
  commandHistory: CommandOutcome[];
  consentTrail: ConsentEvent[];
  subscription: {
    plan: string;
    status: 'active' | 'expired' | 'trial' | 'none';
    renewsAt: string | null;
    commandsThisPeriod: number;
  };
  accessibilityServiceEnabled: boolean;
}

type Action =
  | { type: 'COMPLETE_ONBOARDING' }
  | { type: 'SET_LANGUAGE'; language: 'am-ET' | 'en-US' }
  | { type: 'SET_CONSENT'; granted: boolean }
  | { type: 'SET_DATA_RETENTION'; optIn: boolean }
  | { type: 'SET_SPEECH_RATE'; rate: number }
  | { type: 'SET_WAKE_WORD'; word: string }
  | { type: 'ADD_COMMAND_OUTCOME'; outcome: CommandOutcome }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'ADD_CONSENT_EVENT'; event: ConsentEvent }
  | { type: 'SET_ACCESSIBILITY_SERVICE'; enabled: boolean }
  | { type: 'HYDRATE'; state: Partial<AppState> }
  | { type: 'DELETE_ALL_DATA' };

const initialState: AppState = {
  onboardingComplete: false,
  selectedLanguage: 'am-ET',
  consentGranted: false,
  dataRetentionOptIn: false,
  speechRate: 100,
  wakeWord: 'Echo',
  commandHistory: [],
  consentTrail: [],
  subscription: {
    plan: 'EchoGuide',
    status: 'none',
    renewsAt: null,
    commandsThisPeriod: 0,
  },
  accessibilityServiceEnabled: false,
};

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'COMPLETE_ONBOARDING':
      return { ...state, onboardingComplete: true };

    case 'SET_LANGUAGE':
      return { ...state, selectedLanguage: action.language };

    case 'SET_CONSENT':
      return { ...state, consentGranted: action.granted };

    case 'SET_DATA_RETENTION':
      return { ...state, dataRetentionOptIn: action.optIn };

    case 'SET_SPEECH_RATE':
      return { ...state, speechRate: action.rate };

    case 'SET_WAKE_WORD':
      return { ...state, wakeWord: action.word };

    case 'ADD_COMMAND_OUTCOME':
      return {
        ...state,
        commandHistory: [action.outcome, ...state.commandHistory].slice(0, 200),
        subscription: {
          ...state.subscription,
          commandsThisPeriod: state.subscription.commandsThisPeriod + 1,
        },
      };

    case 'CLEAR_HISTORY':
      return { ...state, commandHistory: [] };

    case 'ADD_CONSENT_EVENT':
      return {
        ...state,
        consentTrail: [action.event, ...state.consentTrail],
      };

    case 'SET_ACCESSIBILITY_SERVICE':
      return { ...state, accessibilityServiceEnabled: action.enabled };

    case 'HYDRATE':
      return { ...state, ...action.state };

    case 'DELETE_ALL_DATA':
      return {
        ...initialState,
        onboardingComplete: false,
        selectedLanguage: state.selectedLanguage,
      };

    default:
      return state;
  }
}

const STORAGE_KEY = '@echoguide/app_state';

interface AppStateContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export const useAppState = (): AppStateContextType => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};

interface ProviderProps {
  children: ReactNode;
}

export const AppStateProvider: React.FC<ProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [hydrated, setHydrated] = React.useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          dispatch({ type: 'HYDRATE', state: parsed });
        }
      } catch (e) {
        console.warn('[AppState] Failed to hydrate:', e);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      try {
        const toPersist: Partial<AppState> = {
          onboardingComplete: state.onboardingComplete,
          selectedLanguage: state.selectedLanguage,
          consentGranted: state.consentGranted,
          dataRetentionOptIn: state.dataRetentionOptIn,
          speechRate: state.speechRate,
          wakeWord: state.wakeWord,
          commandHistory: state.commandHistory,
          consentTrail: state.consentTrail,
          subscription: state.subscription,
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist));
      } catch (e) {
        console.warn('[AppState] Failed to persist state:', e);
      }
    })();
  }, [state, hydrated]);

  if (!hydrated) {
    return null;
  }

  return (
    <AppStateContext.Provider value={{ state, dispatch }}>
      {children}
    </AppStateContext.Provider>
  );
};
