# Golden audio test set

docs/architecture/testing.md requires a golden audio corpus with asserted thresholds for the
confidence gate (a merge gate), and docs/architecture/decisions.md a 200-utterance corpus from real
users, scored by word error rate against the vendor's 3% claim (a bilingual-launch gate).

This directory is the interface for both. It ships no human speech.

## Layout

| Path | What |
| --- | --- |
| `manifest.json` | Every corpus entry. Validated against `manifest.schema.ts` on each test run. |
| `manifest.schema.ts` | The entry format. |
| `recordings/` | Approved real recordings. Git-ignored; see its README. |
| `../fixtures/addis/` | Recorded provider responses that replay mode feeds back. |
| `../integration/golden-audio.test.ts` | The harness. |

## Entries

```jsonc
{
  "id": "am-0001",                       // unique, stable
  "language": "am-ET",                   // am-ET | en-US
  "source": "approved-recording",        // synthetic | approved-recording
  "audio": { "kind": "recording", "path": "recordings/am-0001.wav" },
  //    or { "kind": "synthetic", "signal": "tone" | "silence" | "noise", "duration_ms": 1200 }
  "expected_transcript": "ቻቶችን ክፈት",     // reference text for WER (recordings)
  "provider_fixture": "stt-transcript-only", // replay mode: the response to feed back
  "expected": { "gate": "CONFIDENCE_UNAVAILABLE", "http_status": 200, "status": "CONFIRMATION_REQUIRED" },
  "consent_ref": "CONSENT-2026-0042"     // required for approved recordings
}
```

## Modes

**Replay (always runs, CI merge gate).** Each entry's audio is uploaded through the real
`POST /v1/commands` path; the fake provider answers with the entry's recorded fixture. The test
asserts the gate outcome and the API status, and that the audio reached the provider as a
16 kHz mono PCM16 WAV. Needs no network, no key and no human audio. Entries whose recording is
absent are skipped with a stated reason.

**Live (opt-in).** `GOLDEN_AUDIO_LIVE=1 ADDIS_AI_API_KEY=… npm run test:golden:live` sends every
approved recording to the real Addis AI speech-to-text endpoint, computes corpus word error rate
against `expected_transcript`, and fails above `GOLDEN_AUDIO_MAX_WER` (default 0.03). It also
reports which response shape the vendor returned, which is how the assumptions in
`src/shared/adapters/addis_ai_response_adapter.ts` get confirmed. With no approved recordings or
no key it skips, and says why.

## Adding real recordings

1. Record with the app's capture settings (16 kHz, mono, PCM16, 0.4–15 s).
2. Obtain and file consent; put its reference in `consent_ref`.
3. Copy the WAV into `recordings/` and add an entry with `"source": "approved-recording"`.
4. Capture the vendor's real response once (live mode prints it by field shape) and save it as a
   fixture so replay mode covers it too.
