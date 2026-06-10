---
description: Drive the hardware bring-up checkpoint ladder when something won't come up
argument-hint: [board/arch, and the symptom: no output, hangs, faults, config fails]
---

The user is bringing up bare-metal code, firmware, or an FPGA on real hardware and it will not come up. Context and symptom: $ARGUMENTS

Invoke the relevant skill for the situation: `bare-metal-bringup` for kernel/bare-metal on a new arch or board, `fpga-bringup` for loading and driving a bitstream over JTAG/GPIO, `firmware-boot-chain` for a firmware or bootloader handoff. Then drive the bring-up as a ladder, proving each rung before climbing:

1. Get one known byte out a UART first. Until there is output, the rest is blind.
2. Stack and BSS valid and correctly placed.
3. Trap vectors installed and proven by a deliberate trap (mind part-specific vector alignment).
4. Architectural timer init before any kernel timer that divides by its frequency.
5. Address translation: identity-map then enable (watch for silent overlapping-PMP rejection).
6. Interrupts: right enable model; pollers on a shared line must suppress.
7. Userspace/syscalls: preserve exactly what the ABI promises.

For FPGA config: prove the transport first (IDCODE, IR width), read back DONE rather than trusting the shift, and confirm the bitstream clock is at or below real Fmax. For a boot chain: map the handoffs and find the failing arrow.

Localize the failing rung with evidence before proposing any fix. Treat "works in sim, dead on hardware" or "works in TCG, dies in KVM" as a real ordering or state-save bug, not a tooling quirk. Add a raw output byte at the suspect transition to bisect.
