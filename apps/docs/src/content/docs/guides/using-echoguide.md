---
title: Using EchoGuide
description: How to speak to EchoGuide, what it says back, and what happens when it is not sure.
---

This page is for using EchoGuide on your phone. It assumes nothing technical.

## Turn on the permission first

EchoGuide works by operating your other apps for you. Android will not let it do that until you
allow it by hand, once:

**Settings → Accessibility → EchoGuide → turn on.**

Nothing else works until this is on. If EchoGuide answers you but nothing happens on screen,
this is almost always why.

You will also be asked, when you first open the app, to choose your language, allow the
microphone, and decide whether EchoGuide may keep anything. You can change all three later.

## Speaking to it

Say the wake word, then say what you want in your own words.

You do not need to learn commands. EchoGuide does not match your speech against a fixed list —
it works out what you meant and then does it. Amharic and English both work, and you can switch
languages at any time from settings.

Three things worth knowing:

- **Pause when you are done.** About **0.7 seconds** of silence tells EchoGuide you have
  finished. A short pause mid-sentence will not cut you off.
- **Speak for at least half a second.** Anything shorter is treated as a noise and ignored.
- **Keep it under 15 seconds.** That is a hard limit.

EchoGuide is not listening the whole time. It starts recording when it hears the wake word and
stops when you stop talking.

## What you will hear back

**Every outcome is spoken.** Silence is treated as a fault, not a result — if EchoGuide ever goes
quiet in the middle of something, that is worth reporting.

You should hear a short acknowledgement within about **half a second** of finishing your
sentence. That confirms you were heard. It comes before the work is done, not after.

Then one of these:

| What you hear | What it means |
| --- | --- |
| It describes the action and does it | Understood. It is working. |
| It asks you to confirm | The action cannot be undone easily. Say yes or no. |
| It asks you to say it again | It was not confident enough to act. It will try twice. |
| It says it cannot do that | The plan was not something EchoGuide is allowed to perform. |

## When it asks you to confirm

Some actions are hard to take back — sending, deleting, paying. For those, EchoGuide describes
what it is about to do and waits.

It will not act until you agree. Declining cancels the whole thing, and nothing is performed.

This is deliberate. EchoGuide can drive any app on your phone, including your bank, so it asks
before doing anything it cannot undo.

## When it asks you to repeat

If the audio was unclear, EchoGuide asks rather than guessing. It will try up to **twice** before
giving up and telling you so.

This usually means background noise, a very short phrase, or the microphone being covered. Acting
on a bad guess is worse than asking again.

## What it keeps

**By default, nothing.** No recordings, no text of what you said.

Your audio is used to work out what you asked for and is then gone. You can opt in to letting
EchoGuide keep your command history if you want failures investigated or recognition improved on
your own voice — and you can turn that back off whenever you like.

The full detail is in [Privacy and data](/reference/privacy/).

## If something is not working

**It answers, but nothing happens on screen.** The accessibility permission is off. See the top
of this page.

**It never answers at all.** The phone is not reaching the internet. EchoGuide needs a connection
to understand you.

**It keeps asking you to repeat.** Move somewhere quieter, or hold the phone closer.

**It goes silent mid-command.** That is a bug. Every state is supposed to be spoken.
