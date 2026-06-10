---
name: silicon-grade-discipline
description: Use when writing hardware, firmware, verification, or tooling code that will reach real silicon, and you face a tradeoff between shipping fast and shipping correct; covers failures-should-fail, no over-engineering, no-panic, and test coverage
---

# Silicon-Grade Discipline

## Overview

Software bugs ship a patch. Hardware bugs ship a respin, or a recall, or a dead board on a bench you can't reach. That asymmetry changes how you write code in this domain: correctness is not negotiable against speed, because the cost of wrong is measured in mask sets and weeks.

**Core principle:** A failure must be loud, a check must be honest, and a fix must address the root cause. The most dangerous output in this domain is a green checkmark over a real defect.

## When to Use

- Writing or reviewing code that drives, verifies, or generates hardware
- Tempted to add a flag that makes a failing check pass
- Tempted to add recovery scaffolding for a failure mode you haven't diagnosed
- Deciding between `panic`/`assert` and returning an error
- Deciding how much test coverage is enough

This skill is the shared backbone; the domain skills (`hdl-module-design`, `tapeout-precheck`, `differential-verification`, and others) lean on it.

## Failures Should Fail

Never add a knob that converts a real failure into a pass. No `ERROR_ON_DRC=false`, no `--skip-lvs`, no `if (mismatch) verdict = pass`, no "temporarily" commented-out assertion. Those don't fix the problem; they hide it and then ship it.

- A failing check means the design or the code is wrong. Fix the thing being checked.
- A legitimate exception is explicit, recorded, and granted by the authority that owns the rule (the foundry, the spec), with its rationale written down. It is never a flag you flipped to hit a date.
- Trust the logs. Read what the tool actually reported. "0 errors" from a run that skipped the check is worse than a red failure, because it lies.

## Don't Over-Engineer Recovery Hatches

Resist building preemptive save-on-failure, retry-until-it-works, or rollback scaffolding around a failure you haven't understood. That machinery hides the bug, adds surface area, and convinces you the system is robust when it is actually papering over a real defect.

- Diagnose the root cause first. A retry loop around a corruption just corrupts more slowly.
- Trust the logs and the crash. A clean fault that tells you where it broke is more valuable than a system that limps past the break.
- Build the recovery you actually need, once you understand the failure, not the recovery you imagine you might need.

## Don't Panic; Return Errors

Reserve `panic`/`abort`/unwrap-on-error for genuinely impossible states (an invariant the type system can't express, which if violated means memory is already corrupt). For everything that can fail in normal operation (bad input, a device that didn't respond, a parse that failed), return a typed error and let the caller decide.

- Library code returns typed errors (thiserror-style). User-facing layers render them nicely (color-eyre-style). Structured logging (tracing-style) records the context.
- A panic in a verification farm or a bring-up tool takes down the run and loses the diagnostic. An error propagates the context you need.

## Test Like It's Going To Silicon

Because it is.

- Exhaustive coverage per component, not just the happy path through the top level. Sweep parameters and boundaries.
- Test files mirror the source layout so every unit's test is findable.
- Cover the failure paths: assert that bad input actually errors, that validation actually rejects.
- Logic lives in the library so it's testable without a process; the CLI/daemon is a thin consumer.

## Red Flags

| Thought | Reality |
|---------|---------|
| "I'll add a flag to skip this check for now" | That flag ships a known defect. Fix the check's subject. |
| "Let me add a save/retry in case it fails" | Diagnose first. Recovery for an undiagnosed failure hides it. |
| "I'll panic here, it shouldn't happen" | If it can happen in normal operation, return an error. |
| "0 errors printed, we're good" | Confirm the check actually ran. Trust the logs, not the absence. |
| "Top-level test passes, that's enough" | Cover each component and its failure paths. |
| "It's close enough" | For silicon, close enough is a respin. |

## Midstall House Style

- These rules recur across Aegis, Harbor, Heimdall, Ferrite, and the rest, because everything here is heading toward real hardware.
- No design docs for their own sake; keep reasoning in-conversation and fix the root cause.
- No em dashes, no emoji, no slang. Plain, direct, honest about what works and what doesn't.
