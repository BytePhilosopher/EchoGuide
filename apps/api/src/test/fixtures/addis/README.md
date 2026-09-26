# Addis AI response fixtures

The vendor's response schema is not published in this repository, so these fixtures encode the
shapes the code has to handle, and where each one comes from. None of them contains real user
speech. When the real schema is confirmed, update these fixtures together with
`src/shared/adapters/addis_ai_response_adapter.ts`.

| File | Source of the shape | Status |
| --- | --- | --- |
| `stt-with-confidence.json` | The test double the repository used before this change (`data.transcription` + top-level `confidence`) | Assumed |
| `stt-transcript-only.json` | docs/architecture/command-pipeline: "The transcriber returns no confidence score" | Documented |
| `stt-segments-whisper.json` | docs/architecture/command-pipeline: derive confidence from `avg_logprob`, `no_speech_prob`, `compression_ratio` | Documented intent, field location assumed |
| `stt-low-logprob.json` | As above, with `avg_logprob` below −1.0 | Documented thresholds |
| `stt-no-speech.json` | As above, with `no_speech_prob` above 0.6 | Documented thresholds |
| `stt-repetition.json` | As above, with `compression_ratio` above 2.4 | Documented thresholds |
| `stt-malformed.json` | Provider answered without `data.transcription` | Failure case |
| `stt-confidence-out-of-range.json` | A `confidence` outside 0..1 (for example a percentage) | Failure case: treated as unavailable, never rescaled |
| `plan-valid.json` | `POST /api/v1/chat_generate` → `response_text`, as the adapter has always read it | Assumed |
| `plan-not-json.json` | The model replied with prose | Failure case |
