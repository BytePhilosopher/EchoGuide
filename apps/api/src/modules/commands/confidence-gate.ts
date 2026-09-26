import type { NormalizedTranscription } from '../../shared/adapters/addis_ai_response_adapter';

/**
 * The confidence gate runs after transcription and before any planning call is spent.
 *
 * Thresholds come from docs/architecture/command-pipeline:
 *   avg_logprob below −1.0      → the model was guessing          → LOW_CONFIDENCE
 *   no_speech_prob above 0.6    → probably not speech             → NO_SPEECH
 *   compression_ratio above 2.4 → repetition loop                 → REPETITION
 * A provider-supplied 0..1 score is gated on ADDIS_CONFIDENCE_FLOOR (0.6).
 *
 * CONFIDENCE_UNAVAILABLE is its own outcome, never a number. Its policy is configurable:
 *   confirm  (default) plan as normal, but every non-empty plan comes back CONFIRMATION_REQUIRED,
 *            so nothing executes until the user hears the request and says yes. The confidence
 *            gate is a cost and usability control; the safety controls (schema validation, the
 *            per-app allowlist, destructive-step confirmation, on-device revalidation) all still run.
 *   reprompt treat unavailable as low confidence and ask again.
 * Rejecting every unscored command outright would disable the product whenever the vendor sends
 * no score, which docs say is the normal case.
 */
export type GateThresholds = {
  confidenceFloor: number;
  avgLogprobFloor: number;
  noSpeechProbMax: number;
  compressionRatioMax: number;
  unavailablePolicy: 'confirm' | 'reprompt';
};

export type GateVerdict =
  | { outcome: 'VALIDATED'; confidence: number }
  | { outcome: 'LOW_CONFIDENCE'; confidence: number }
  | { outcome: 'NO_SPEECH'; confidence: number | null }
  | { outcome: 'REPETITION'; confidence: number | null }
  | { outcome: 'EMPTY_TRANSCRIPT'; confidence: number | null }
  | { outcome: 'CONFIDENCE_UNAVAILABLE'; policy: 'confirm' | 'reprompt'; confidence: null };

export function evaluateConfidence(transcription: NormalizedTranscription, thresholds: GateThresholds): GateVerdict {
  const signal = transcription.confidence;
  const reported = signal.kind === 'unavailable' ? null : signal.value;

  if (signal.kind === 'derived') {
    if (signal.noSpeechProb !== null && signal.noSpeechProb > thresholds.noSpeechProbMax) {
      return { outcome: 'NO_SPEECH', confidence: reported };
    }
    if (signal.compressionRatio !== null && signal.compressionRatio > thresholds.compressionRatioMax) {
      return { outcome: 'REPETITION', confidence: reported };
    }
  }

  if (transcription.transcript.trim().length === 0) return { outcome: 'EMPTY_TRANSCRIPT', confidence: reported };

  switch (signal.kind) {
    case 'derived':
      return signal.avgLogprob < thresholds.avgLogprobFloor
        ? { outcome: 'LOW_CONFIDENCE', confidence: signal.value }
        : { outcome: 'VALIDATED', confidence: signal.value };
    case 'score':
      return signal.value < thresholds.confidenceFloor
        ? { outcome: 'LOW_CONFIDENCE', confidence: signal.value }
        : { outcome: 'VALIDATED', confidence: signal.value };
    case 'unavailable':
      return { outcome: 'CONFIDENCE_UNAVAILABLE', policy: thresholds.unavailablePolicy, confidence: null };
  }
}
