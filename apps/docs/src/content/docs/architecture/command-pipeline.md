---
title: Command pipeline
description: The hot path from end of speech to executed action — capture parameters, the confidence gate, split speech output, and the command state machine.
---

This is the only flow whose latency a user feels. Every step on the phone is Kotlin.

## One command, end to end

```mermaid
sequenceDiagram
    accTitle: Command sequence
    accDescr: The Kotlin pipeline closes the audio buffer when voice activity detection ends, then posts it to the API. The API sends the audio and a vocabulary prompt to Addis speech to text and receives text with confidence. The API applies the confidence gate. Below the gate, it asks the phone to reprompt, at most twice. If accepted, the API sends the command and screen context to the Addis language model, receives an action plan, validates it against the allowlist, and returns it. The phone executes the plan, then speaks.
    participant K as Kotlin pipeline
    participant A as API
    participant S as Addis STT
    participant L as Addis LLM

    K->>K: VAD closes buffer
    K->>A: POST /v1/commands
    A->>S: audio + vocab prompt
    S-->>A: text + confidence
    A->>A: confidence gate
    alt below gate
        A-->>K: reprompt (max 2)
    else accepted
        A->>L: command + screen context
        L-->>A: action plan
        A->>A: validate against allowlist
        A-->>K: action plan
        K->>K: execute, then speak
    end
```

Two rules sit around this sequence:

- **A buffer shorter than 0.4 s never becomes a request.** The phone discards it as noise.
- **Two rejections, then a way out.** After two rejections the client offers on-screen input instead of asking a third time.

A blind user trapped in an endless "say that again" loop is the worst state this product can
reach.

## Capture parameters

| Parameter | Value | Reason |
| --- | --- | --- |
| Sample rate | 16 000 Hz | Native rate of the transcriber; higher is discarded |
| Channels | Mono | Stereo doubles the payload for no accuracy gain |
| Encoding | PCM 16-bit | Lossless capture, encoded before upload |
| Audio source | `VOICE_RECOGNITION` | Applies the device's speech-tuned processing |
| Minimum utterance | 0.4 s | Below this, treat as noise and send nothing |
| Maximum utterance | 15 s | Hard stop; a longer buffer means VAD failed |
| End-of-speech silence | 700 ms | Survives a mid-sentence pause, still feels responsive |

**Raw microphone audio is never streamed continuously.** VAD gates every request. Without it the
app uploads silence, burns data on a metered connection, and creates a privacy problem with no
defence.

## The confidence gate

The transcriber returns no confidence score. The backend derives one from what it does return,
and rejects **before** spending a planning call.

| Signal | Threshold | Meaning |
| --- | --- | --- |
| `avg_logprob` | Below −1.0 | The model was guessing |
| `no_speech_prob` | Above 0.6 | Probably not speech — reset silently |
| `compression_ratio` | Above 2.4 | Repetition loop, a known failure mode |

The surviving `avg_logprob` is mapped onto 0–1 and gated on. These thresholds are a starting
point to tune against real recordings, not a result.

:::caution[Schema mismatch]
`ConfidenceGateSchema` in `packages/openapi` declares `avg_logprob` with `.max(-1.0)`, which
accepts only values at or below −1.0. The design says below −1.0 means the model was guessing,
so the schema's direction is inverted. Treat the table above as the intent.
:::

## Speech output

Android's built-in synthesis has no dependable Amharic voice. The vendor's does, so the response
path splits by language.

| Language | Engine | Latency | Reason |
| --- | --- | --- | --- |
| English | On-device Android TTS | Near zero | Adequate quality, no network |
| Amharic | Addis AI TTS | Network round trip | The only path to a natural Amharic voice |

Amharic replies cost an extra round trip that English replies do not. Two mitigations keep it off
the critical path:

- **Pre-synthesise the fixed phrases.** Acknowledgements, the retry prompt, the confirmation question and every error line are a closed set. Synthesise them once, ship them with the app, refresh on language change.
- **Stream the variable remainder.** Only content the system could not predict — a message being read aloud — goes to the network. It starts playing on the first chunk, not on completion.

**The acknowledgement is instant in both languages.** That is what the 400 ms target actually
measures.

## Command lifecycle

Every command is a state machine, and **every terminal state produces speech**.

```mermaid
stateDiagram-v2
    accTitle: Command lifecycle
    accDescr: A command starts capturing on the wake word. A buffer under 0.4 seconds is discarded. Otherwise it is transcribed. Low confidence leads to rejected, which retries capturing up to twice and then falls back. Accepted text goes to planning. A plan that fails the allowlist is blocked. A validated plan executes. A destructive step moves to confirming, which returns to executing if the user confirms or is cancelled if they decline. Execution ends done or failed. Discarded, fallback, blocked, cancelled, done and failed are terminal.
    [*] --> capturing : wake word
    capturing --> discarded : buffer < 0.4 s
    capturing --> transcribing : VAD closes buffer
    transcribing --> rejected : confidence below gate
    rejected --> capturing : retry (max 2)
    rejected --> fallback : retries exhausted
    transcribing --> planning : accepted
    planning --> blocked : plan fails allowlist
    planning --> executing : plan validated
    executing --> confirming : destructive step
    confirming --> executing : user confirms
    confirming --> cancelled : user declines
    executing --> done : plan complete
    executing --> failed : step failed
    discarded --> [*]
    fallback --> [*]
    blocked --> [*]
    cancelled --> [*]
    done --> [*]
    failed --> [*]
```

**`blocked` and `confirming` are safety states.** They exist because a planning model is
probabilistic and can drive a banking app. [Security](/architecture/security/) treats that as
the primary threat.

## How states map to the API

The API reports four statuses. The lifecycle above is richer because some states never leave the
phone.

| API status | Lifecycle state |
| --- | --- |
| `ACCEPTED` | `executing` |
| `CONFIRMATION_REQUIRED` | `confirming` |
| `REPROMPT` | `rejected` |
| `REJECTED` | `blocked` |

`discarded` never reaches the API. `done`, `failed` and `cancelled` happen on the phone after
the response. The full contract is in the [API reference](/reference/api/).
