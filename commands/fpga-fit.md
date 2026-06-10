---
description: Drive the measure-don't-guess FPGA fit and timing loop on a design
argument-hint: [module, target part, or what's failing to fit/route]
---

The user wants to fit an RTL design onto an FPGA, hit timing, or fix a route that will not converge. Context they gave: $ARGUMENTS

Invoke the `fpga-synthesis-fit` skill, and `rtl-area-timing` if the bottleneck is a structure (a wide multiply, a barrel shifter, a compute-everything-and-select datapath). Then drive this loop, one measured step at a time:

1. Measure with the right number. Read post-pack nextpnr `TRELLIS_COMB` (or the equivalent post-place utilization), never the pre-pack synth LUT count. For timing, read the critical-path report and name the specific primitive on it.
2. If it will not route: try other seeds before changing RTL, watch the overused-wire count trend toward zero, and keep utilization under the thrash threshold (roughly 85 percent, and BRAM under 90).
3. If it is too big or too slow: apply one structural change from `rtl-area-timing` (internal multiply pipeline, dead-arm removal, resource sharing, fixed-slice mux), then re-measure post-pack. Stop optimizing a resource once it leaves the critical path.
4. Check for the flop-ROM trap: a "ROM" with per-entry reset values becomes a huge flop array. Instantiate block RAM with init instead.
5. If you generate a bring-up bitstream, confirm its configured clock is at or below the measured Fmax.

Report each step's measurement and the one change you made, not a batch of speculative edits. Do not claim a win without a post-pack number.
