# DP16KD INITVAL Packing (ECP5)

How to instantiate a Lattice ECP5 DP16KD block RAM with initialized contents,
so a ROM/RAM maps to block RAM instead of a flop array. Derive the exact packing
from yosys's own `share/yosys/lattice/brams_map_16kd.v` (`init_slice`); do not
reinvent it. This file records the layout so you can sanity-check the result.

## x18 mode geometry

- 64 `INITVAL_xx` parameters, each 320 bits = 16 words.
- Word `i` sits at bits `[i*20 +: 18]` (18 data bits in a 20-bit slot; the top 2
  bits of each 20-bit slot are unused in x18 mode).
- 64 slices x 16 words = 1024 words deep.
- Width greater than 18 bits: use `ceil(W / 18)` DP16KD blocks side by side, each
  holding bits `[b*18 +: 18]` of every word.
- The x18 word address sits in `AD[13:4]`; the low 4 bits are tied to 0.

## Ports

- Port A = write.
- Port B = registered read (readLatency 1).
- The registered read IS your read-pipeline stage. Do not add a separate
  register stage after it, or you double-count latency.

## Simulation

You cannot simulate a DP16KD blackbox honoring INITVAL. Keep a flop-based model
for simulation at the SAME read latency (1) as the DP16KD, and verify against
that. Running the sim model at a faster latency than the real primitive verifies
the wrong hardware. See the RegisterFile read-latency note in `rohd-rtl-gotchas`.

## Checklist

- Is the thing you think is a ROM actually flops? Generic yosys stat shows it as
  N `$sdffe`. If so, it has per-entry reset values and never became BRAM.
- Did you instantiate DP16KD explicitly with INITVAL, rather than relying on
  inference?
- Does the sim flop model run at read latency 1 to match port B?
- For width > 18, is each block sliced as `[b*18 +: 18]` and addressed in parallel?
