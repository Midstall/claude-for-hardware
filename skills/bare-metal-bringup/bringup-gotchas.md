# Bare-Metal Bring-Up Gotchas

Concrete failures hit during real multi-arch bring-up, organized by checkpoint. Each is a "looked fine, silently broke" trap. Use as a checklist when a rung won't go green.

## Stack / load layout

- **Stack inside the wrong segment.** On multiboot/i386, the early stack must sit inside the BSS LOAD segment, or the loader (GRUB) places the initrd module on top of it. Symptom: a signature/checksum failure on a *later* artifact, not the first one.
- **mmap base overlapping the binary.** The userspace mmap base must sit strictly above the loaded image base. If equal, the first allocation maps over the loaded binary and the next parse step traps with a wild PC.

## Trap vectors

- **Alignment is not 4 bytes.** Some RISC-V cores (ESP32-C6) require the trap base 256-byte aligned and force vectored mode. Disable relaxation and compression (`.option norelax`, `norvc`) so each vector slot stays 4 bytes.
- **Trap entry clobbers temporaries before saving them.** If the entry sequence uses `t0`/`t1` before stashing them, you corrupt user state on every trap. Save first, then use scratch.
- **Thread pointer lost across U->S.** Re-establish `tp`/per-CPU pointer on kernel entry; don't assume it survived the mode switch.

## Timers

- **Architectural timer init must precede kernel timer init.** If the kernel timer reads `arch.timer.now()` before `arch.timer.init` set the frequency, it divides by zero and panics with no other output. This looks like a totally dead boot.

## Address translation (MMU / PMP)

- **Overlapping PMP regions silently fail.** Some chips (ESP32-C6) do not support overlapping PMP entries; one wide-open NAPOT region silently does nothing. Use per-region PMP plus gap-marking PMA entries and open the access-permission registers explicitly.
- **Identity-map before enabling.** Whatever code runs right after translation turns on must be mapped at the same VA it's executing from, or you fault on the next instruction fetch.
- **High-half teardown frees kernel mappings.** A user address-space destroy that walks the whole table can free the kernel's high-half; bound the walk to user VAs.

## Interrupts

- **Per-IRQ enable vs global enable.** Some parts want per-IRQ `mip`/`mie` bits set (mie = all ones), not a single global external-interrupt-enable bit. Wrong model means interrupts never fire.
- **Pollers must suppress interrupts on shared lines.** A polling driver that shares an INTx line with an interrupt-driven driver must set the no-interrupt flag, or it storms the shared line and freezes the other driver.

## Syscall ABI

- **Clobbered preserved registers.** The entry stub must push/restore the registers the user ABI promises to preserve (commonly arg/temp regs and the user stack pointer) around the dispatch. A sibling thread's syscall can overwrite a user-RSP saved to a shared per-CPU slot during a blocking call; save to the kernel stack instead.
- **64-bit args truncated on 32-bit boundary.** `int 0x80` truncates 64-bit args to 32; sentinel/"query size" checks must compare against pointer-width max, not `u64` max, or they fall through to a null deref. 64-bit returns come back split across two registers (edx:eax) and must be stitched on both sides.
- **Build the return frame from a safe slot.** Don't restore the user register and then overwrite it with a per-CPU read while building the iret/sret frame; push from the safe source directly.

## Emulator vs accelerator (TCG vs KVM)

- **FP/SIMD not saved on the trap path.** Userspace touching NEON/FP is safe only if the kernel saves that state on traps and context switches. TCG often tolerates the omission; KVM faults.
- **Per-CPU pointer not set before first IRQ.** Set the current-CPU pointer before enabling interrupts, or the first IRQ under KVM dereferences garbage.
- **Reusing a list link for two purposes.** A timer sleeper list that reuses the runqueue `next` link corrupts one when the other runs; give each its own link. Surfaces as a null-branch crash under KVM only.

## Toolchain / codegen

- **mem* intrinsics self-recurse.** A hand-written `memset`/`memcpy` can be rewritten by the compiler into a tail-call to itself; disable intrinsics or use a volatile pointer loop.
- **Linker script ignored on some freestanding targets.** Confirm your sections actually landed where the script says; some target/format combos quietly ignore it.
