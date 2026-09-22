---
title: Voice commands
description: How EchoGuide turns a spoken sentence into actions, and what each of the four outcomes means.
---

EchoGuide does not match your speech against a fixed list of phrases. It transcribes what
you said, plans a sequence of actions against what is currently on screen, and then
validates that plan before anything is allowed to run.

That means you can phrase a request naturally, in Amharic (`am-ET`) or English (`en-US`).
What constrains the system is not vocabulary — it is the action allowlist.

## What EchoGuide is allowed to do

Every plan compiles down to steps drawn from exactly five action types. Anything a model
proposes outside this set is rejected before it reaches your phone.

| Action | Effect |
| --- | --- |
| `TAP` | Activates a node in the current view tree |
| `SCROLL` | Scrolls a scrollable container |
| `TEXT_INPUT` | Types a string into a focused input |
| `BACK` | Android back navigation |
| `HOME` | Returns to the launcher |

A step carrying `is_destructive` forces a spoken confirmation before it runs. The design
target for the executor is **zero** unintended destructive actions.

## The four outcomes

Every command resolves to one of four statuses, and each one is spoken aloud.

**`ACCEPTED`** — the plan passed validation and is executing.

**`CONFIRMATION_REQUIRED`** — the plan contains a destructive step. EchoGuide describes
what it is about to do and waits for you to agree.

**`REPROMPT`** — the transcription was not trustworthy enough to act on. You are asked to
say it again. This is deliberate: acting on a bad guess is worse than asking twice.

**`REJECTED`** — a plan was produced but failed allowlist validation. Nothing ran.

## Why a command gets rejected before it is heard

Two gates sit in front of the planner.

**Utterance length.** Audio shorter than **0.4 seconds** is discarded on the phone and
again at the API. It is almost always a cough, a door, or a clipped word.

**Confidence gate.** The transcript is checked on three signals, and failing any one of
them triggers a `REPROMPT` rather than a guess:

| Signal | Threshold | What it catches |
| --- | --- | --- |
| `avg_logprob` | at most `-1.0` | The model is guessing |
| `no_speech_prob` | at most `0.6` | The audio is background noise |
| `compression_ratio` | at most `2.4` | A repetition-loop failure |

## Silence is a failure

If you cannot see the screen, an app that goes quiet is indistinguishable from an app that
has crashed. EchoGuide treats silence as a bug: every state, including every rejection and
every error, is announced.

If EchoGuide ever goes quiet mid-command, that is worth reporting.
