---
name: fpga-bringup
description: Use when loading a bitstream onto a physical FPGA and driving or observing it over JTAG or GPIO, especially bit-banged JTAG from a host like a Raspberry Pi, or when configuration silently fails
---

# FPGA Bring-Up

## Overview

Bringing up an FPGA on the bench means three things: get the bitstream in over a real transport, drive the design's inputs, and observe its outputs. Most early failures are transport and pin-mapping problems, not logic problems.

**Core principle:** Bring the transport up first and prove it independently, before you trust anything the design does. A bitstream that "loaded" but didn't is the most expensive hour on the bench.

## When to Use

- Loading a bitstream onto a board over JTAG, SPI, or a custom config chain
- Bit-banging JTAG from GPIO (Pi-as-host, no FTDI/FT2232)
- Driving test vectors into pins and reading results back
- Configuration "succeeds" but the design doesn't run

## Bring Up The Transport First

Before any design-level work, prove the link end to end:

1. **Read the IDCODE.** Shift the JTAG IDCODE instruction and confirm the value matches the part. If IDCODE is wrong or all-ones/all-zeros, you have a wiring, voltage, or clock problem. Stop here and fix it. Nothing downstream matters yet.
2. **Confirm the IR width.** The instruction register width is part-specific and must match the design's TAP. A wrong IR width shifts every instruction into garbage and configuration silently no-ops. Make the IR width a parameter, not a magic constant baked in one place.
3. **Confirm clock and levels.** TCK speed, signal voltage, pull directions. Bit-banged GPIO has no buffering; mind the levels and keep TCK slow until the link is proven.

## Load The Bitstream

- Use the part's documented configuration instruction (for example a JTAG `CONFIG` opcode) to enter config mode, then shift the bitstream.
- After load, read back a status or DONE indication. Do not assume success from "the shift completed." A clocked-but-ignored shift looks identical to a real one.
- If load fails intermittently, suspect TCK too fast, marginal levels, or a shared bus contending during config.

## Generate The Bitstream At A Safe Clock

Before you blame the bench, confirm the bitstream's configured clock is at or below the design's real Fmax. The PLL output, UART baud divisor, and timer timebase all derive from it. A bitstream configured for 48 MHz on logic that only times at 29 MHz fails with setup violations AND a wrong baud rate, which looks exactly like a wiring or transport fault. Regenerate at a clean integer PLL divide below Fmax. See `fpga-synthesis-fit`.

## Map The Pins Explicitly

Keep a pad map in config (a file, not scattered constants): logical signal name -> device pad -> host GPIO line. Every drive and observe goes through this map.

- Open the GPIO lines on `prepare`, close them on `release`. Own the lifecycle so a crashed run doesn't leave lines claimed.
- Drive inputs, settle, then sample outputs. Respect setup/hold; don't sample combinationally before the design has propagated.
- A `RunVector` is: set inputs per the pad map, pulse/settle, read outputs per the pad map, compare to expected.

## Host Setup (Pi-as-host)

- Use the Linux character-device GPIO interface (gpiod / cdev), not the deprecated sysfs path.
- The host user needs the right group to access GPIO; a diagnostics step that checks group membership, tool presence, and line availability saves a lot of confusion.
- Bit-banged JTAG works without an FTDI adapter, which is the point: fewer parts on the bench.

## Red Flags

| Smell | Do instead |
|-------|------------|
| Assuming load worked because the shift finished | Read back DONE/status |
| IR width hardcoded in one spot | Parameterize it; confirm against the part |
| Pin numbers scattered through code | One pad map, name -> pad -> GPIO line |
| Sampling outputs immediately | Settle for propagation first |
| sysfs GPIO | character-device GPIO (cdev/gpiod) |
| Skipping IDCODE | Always read IDCODE before trusting the link |

## Midstall House Style

- Aegis over bit-banged JTAG from a Pi host is the reference setup; the IR width is parameterized and the loader uses the documented JTAG CONFIG opcode.
- The pad map lives in config (heimdall.toml style), resolved at startup. GPIO transports open on prepare and close on release.
- No em dashes, no emoji. Pairs with `differential-verification` for comparing observed outputs against a golden model.
