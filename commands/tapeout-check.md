---
description: Run the tapeout precheck gate on a design before submission
argument-hint: [design/run dir, foundry or shuttle, or what's failing]
---

The user is preparing a design for tapeout or an MPW shuttle. Context: $ARGUMENTS

Invoke the `tapeout-precheck` skill (and `silicon-grade-discipline` for the failures-should-fail stance). Then walk the signoff gate honestly, in order:

1. DRC: read the actual report and confirm zero unwaived violations. Do not infer clean from an absent error message or a run that skipped the rule deck.
2. LVS: confirm the extracted netlist matches the source exactly, no shorts, opens, or unintended merges.
3. Density and fill satisfied without introducing new violations.
4. Submission package: top-cell name, layer map, metadata, and file format correct for this foundry or shuttle.

Enforce the hard rules: a failing check means fix the design, never disable the checker; never flatten and merge std-cell metal across cell boundaries; a legitimate waiver is foundry-granted in writing, not a flag flipped to hit a date.

If the user is asking whether they can suppress or wave a violation, the answer is to fix the design unless they have a written foundry waiver. Give a clear ready / not-ready verdict with blocking items and their design-side fixes.
