# Skill evals

These skills are not asserted to be good, they are measured. This directory holds
the benchmarks that prove each skill (a) teaches something the base model does not
already know and (b) fires at the right time without over-triggering.

The scripts are Claude Code workflow scripts: they orchestrate subagents, so they
run via Claude's Workflow tool, not as standalone node programs. Ask Claude to run
one, for example "run the discovery benchmark", or point the Workflow tool at the
script path.

## The three benchmarks

### `skill-benchmark.mjs` (usefulness)

For each skill, two subagents answer the same hardware problem: a baseline that is
forbidden the skill, and a treatment that is told to read and apply it. A strict
judge scores both against a fixed list of ground-truth key points distilled from
the river RISC-V project. The signal is the delta: how many real points the skill
adds over the unaided model.

Last run: 13/13 skills beat baseline, average +3.3 ground-truth points per skill,
zero redundant. The standout was `nix-eda-packaging`, where the baseline actively
recommended the anti-pattern the skill exists to forbid.

### `discovery-benchmark.mjs` (routing)

Given only the trigger descriptions and a realistic, non-keyword-stuffed prompt,
does the right skill fire? The catalog includes the competing superpowers process
skills (systematic-debugging, brainstorming, TDD) so routing is honest, plus
negative prompts that should wake no hardware skill. Each case is voted three
times to catch flakiness.

Last run: 100 percent exact fire on clear prompts, zero false positives on the
negatives.

### `adversarial-discovery.mjs` (routing under pressure)

The hard cases: keyword-bait near-misses (the obvious keyword points at the wrong
skill), under-specified prompts that should stay quiet, genuinely multi-domain
prompts, and prompts where a generic process skill competes with a specific
hardware skill.

Last run: every bait resisted, zero over-triggers on vague prompts, ties broken
sensibly, and the specific hardware skill beat the generic debugging skill every
time.

### `verify-hdl-tweak.mjs` (regression check)

A small targeted router check used to confirm a description edit (claiming the
test-writing job for `hdl-module-design`) flipped the intended case without
regressing the others or poaching software test-first work from TDD.

## Method, in one line

Treat a skill like production code: write the test (a scenario plus a ground-truth
oracle, or a routing case plus an accept set), measure the model without the skill
(baseline), measure it with the skill, and keep only what moves the number. The
oracle for these came from the real river project, so the answers are not invented.

## Caveats

- The usefulness eval forces the treatment arm to read the skill, so it measures
  whether the encoded knowledge is non-obvious and gets applied, not whether the
  trigger auto-fires. The discovery evals cover firing.
- The skills and the oracle share a source (river memory), so the oracle rewards
  what the skills encode. The low baseline scores are the honest signal: the base
  model does not produce these specifics unaided.
- Discovery here is a routing proxy over the descriptions, not a full session with
  dozens of competing skills.
