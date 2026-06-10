---
name: rohd-rtl-gotchas
description: Use when building or testing RTL in ROHD (Dart), rohd_bridge, or rohd_hcl and hitting hierarchy-violation errors, "Bad state: No element" at sim setup, co-simulation failures, SystemVerilog emission name mismatches, or unexpected register read latency
---

# ROHD RTL Gotchas

## Overview

ROHD (Rapid Open Hardware Development, Dart RTL) plus rohd_bridge and rohd_hcl have a handful of sharp edges that produce cryptic errors at build or sim setup, far from the actual cause. These are the ones that cost real hours on River and Harbor.

**Core principle:** Most of these surface as a hierarchy-rule violation or a "Bad state: No element" hang, and the fix is almost never where the error points. Match the symptom below to the cause directly instead of debugging the stack trace.

## When to Use

- A ROHD build throws "Violation of input/output rules" or inverts the hierarchy
- Sim hangs or throws "Bad state: No element" during `Sequential` setup
- Co-simulating a DUT against a behavioral model that shares a bidirectional net
- SystemVerilog emission references a module name that the emitted file doesn't define
- A `RegisterFile` read returns data a cycle off from what the FPGA will do

## inout Co-Simulation Between Siblings Is Forbidden

ROHD's hierarchy checker rejects wiring two sibling modules through a shared bidirectional (`inout`/`LogicNet`) net that closes a loop (a SPI controller plus a behavioral SPI-flash model sharing `spi_io`). The error reads "should only communicate via inputs/inouts" and it may even invert the hierarchy (think the DUT contains its parent).

- **For a testbench, avoid the bidirectional co-sim.** Test a path that uses a plain unidirectional input instead (drive MISO procedurally in standard mode rather than the quad `inout` bus). The FSM, byte-order, and data-assembly logic is usually shared across modes, so you still cover it.
- **If you must share an inout**, pass the SAME `LogicNet` to both modules' `addInOut` (the ROHD inout-loopback idiom). Do not `<=` one onto the other. Two active drivers stay fragile; a parent harness beats top-level wiring.
- **Blackbox primitives (DP16KD and friends) have no sim model**, so FPGA-only memory paths can't be co-simulated at all. Verify the equivalent flop model instead, at the same latency (see below).

## "Bad state: No element" Is A Clock Problem

Two distinct causes, same message:

- **`Sequential` clocked on a derived/gated clock.** `Sequential(someModuleOutput, ...)` where the clock is a controller-generated, sometimes-static signal (a generated `spi_clk`) throws at sim setup. Fix: clock the model on the real system clock and detect edges of the derived clock manually (`rising = clk & ~prevClk`, register `prevClk`).
- **`Simulator.reset()` at the wrong time.** It clears registered events including the clock generator. Call it in `tearDown` between tests, never after `build()` and before `Simulator.run()`. The pattern is: build, inject resets, `setMaxSimTime`, `unawaited(Simulator.run())`, then await clock edges.

## rohd_bridge BridgeModule Composition

- Driving a BridgeModule input from a test at top level: `module.input('clk').srcConnection! <= signal` works. Inside a parent module it inverts the hierarchy unless you register the child first with `parent.addSubModule(child)`.
- `addSubModule` only accepts a `BridgeModule`. A plain ROHD `Module` auto-parents via normal inference; do not `addSubModule` it.
- When driving/reading a bus from a test, use the rohd_bridge wishbone port names (`bus_STB`, `bus_CYC`, `bus_WE`, `bus_ADR`, `bus_DAT_MOSI`, `bus_SEL`, `bus_ACK`, `bus_DAT_MISO`), not the `bus.stb` abstraction.

## definitionName Collisions Break SV Emission

Two instances of the same module class with different constructor params (two ROMs with different contents or widths) are different module definitions. ROHD uniquifies the name (`Foo_0`), but per-module SystemVerilog file emission can then collide or mismatch the reference ("RiverCore refs Foo, file defines Foo_0", reported as "module not part of the design").

Fix: give each a distinct stable `definitionName` plus `reserveDefinitionName: true` so the emitted file name and the instantiation agree.

When invoking yosys after `module.generateSynth()`: the top module name in the SV is the class/`definitionName`, not the instance `name`. Grep `^module` to find the real top first.

## RegisterFile Read Latency

`rohd_hcl` `RegisterFile` read is combinational (readLatency 0). `wrapReadForRegisterFile(..., readLatency: N)` delays only `valid`, not `data`/`done`. For a real registered (BRAM) read you must register `data` yourself and craft the done/valid handshake to match.

If a consumer FSM holds its address until `done`, it tolerates +1 read latency for free (one fill cycle per probe). Verify by running the sim flop path at the SAME latency the FPGA BRAM will have, so the sim proves the actual hardware timing. See `fpga-synthesis-fit` for the flop-vs-BRAM latency-matching rule.

## Midstall House Style

- River and Harbor are pure ROHD/Dart RTL, no external Verilog or vendor wrappers; these gotchas all came from that path.
- Keep HDL test files small: `dart test` parallelizes per file, not within a file.
- No em dashes, no emoji. Pairs with `hdl-module-design`, `fpga-synthesis-fit`, and `differential-verification`.
