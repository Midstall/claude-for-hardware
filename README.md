# claude-for-hardware

Claude Code skills for hardware design, validation, and bring-up.

A plugin of focused skills that teach Claude how to do real hardware work:
designing reusable HDL, integrating an SoC, bringing up FPGAs and bare-metal
targets, building firmware boot chains, verifying designs against golden models,
validating codegen on real silicon, prepping a tapeout, and packaging EDA tools
in Nix. Each skill is domain-general but carries Midstall's house style:
failures should fail, fix the root cause, test like it's going to silicon.

## Skills

| Skill | Use when |
|-------|----------|
| `hdl-module-design` | Writing or refactoring an HDL module and you need it parameterized, validated, and testable |
| `reference-driven-rohd` | Implementing a block/protocol/peripheral in ROHD and you should fetch the spec, references, and reusable libs first instead of writing from memory |
| `rohd-rtl-gotchas` | Building or testing RTL in ROHD/rohd_bridge/rohd_hcl and hitting hierarchy, sim-setup, or SV-emission errors |
| `soc-integration` | Composing an SoC from peripherals and a bus, or generating device trees / ACPI from one description |
| `rtl-area-timing` | Optimizing RTL microarchitecture for area or Fmax when a design won't fit or meet timing |
| `fpga-synthesis-fit` | Synthesizing with yosys/nextpnr, fighting area/congestion, measuring Fmax, or instantiating block RAM |
| `fpga-bringup` | Loading a bitstream onto a real FPGA and driving it over JTAG/GPIO |
| `bare-metal-bringup` | Bringing up bare-metal or kernel code on a new arch/board that won't boot or hangs |
| `firmware-boot-chain` | Building or debugging a firmware/boot chain (SBI/UEFI/ACPI/bootloader) or measured boot |
| `differential-verification` | Verifying a DUT against a golden reference model with coverage-guided fuzzing |
| `codegen-validation` | Proving a compiler backend's output by executing it on a real CPU or fast emulator |
| `tapeout-precheck` | Prepping a design for tapeout: DRC/LVS signoff, submission packaging |
| `nix-eda-packaging` | Packaging EDA toolchains in Nix without dlopen/wrapper hacks |
| `silicon-grade-discipline` | Any silicon-bound code facing a fast-vs-correct tradeoff (the shared backbone) |

## Beyond skills

The plugin ships more than the skill files.

**Agents** (`agents/`) bundle the relevant skills into a focused reviewer you can
dispatch at the right moment:

- `rtl-reviewer` reviews an HDL diff against the design and discipline red flags.
- `tapeout-signoff` runs the precheck gate and refuses to wave real violations.
- `bringup-debugger` drives the bring-up checkpoint ladder when hardware is dead.

**Commands** (`commands/`) are guided entry points that drive a workflow:

- `/fpga-fit` runs the measure-don't-guess synthesis and timing loop.
- `/tapeout-check` walks the tapeout signoff gate.
- `/hw-bringup` drives the bring-up ladder for a stuck board.

**Hooks** (`hooks/`) enforce the house style mechanically: a write-time check
rejects em dashes, emoji, and malformed `SKILL.md` frontmatter, so the rules are
automated rather than repeated in prose. The same logic runs in CI via
`scripts/lint-skills.sh`.

**Evals** (`evals/`) are the benchmarks that prove the skills earn their keep:
usefulness (do they beat the unaided model), discovery (do they fire at the right
time), and adversarial discovery (do they resist bait and stay quiet on vague
prompts). See [evals/README.md](evals/README.md). These skills are measured, not
asserted.

## Install

Add the marketplace and install the plugin:

```
/plugin marketplace add Midstall/claude-for-hardware
/plugin install claude-for-hardware
```

Skills activate automatically when their trigger conditions match. You can also
invoke one directly by name.
