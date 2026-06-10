export const meta = {
  name: 'verify-hdl-tweak',
  description: 'Confirm the hdl-module-design description tweak flips the test-writing case without regressing or over-broadening',
  phases: [{ title: 'Route', detail: 'route 4 targeted prompts, 3 votes each, updated catalog' }],
}

const VOTES = 3

// Same catalog as the discovery evals, but with the UPDATED hdl-module-design
// description (now claims the "deciding how to test" job).
const CATALOG = {
  'bare-metal-bringup': "Use when bringing up bare-metal or kernel code on a new architecture, SoC, or board (RISC-V, ARM, x86, ESP32) and it won't boot, hangs after boot, or faults early; covers trap vectors, MMU/PMP, syscall ABI, and boot ordering",
  'codegen-validation': 'Use when building or debugging a compiler backend, codegen, or assembler and you need to prove the generated machine code is correct by executing it on a real CPU or a fast emulator, not just inspecting the output',
  'differential-verification': 'Use when verifying a hardware DUT (a CPU core, FPGA, or netlist) against a golden reference model, building coverage-guided fuzzing, or detecting where silicon diverges from a simulator like Spike, an emulator, or SPICE',
  'firmware-boot-chain': 'Use when building or debugging a firmware and boot chain (RISC-V SBI, UEFI, ACPI, a bootloader handoff like Limine to an OS) or adding measured boot with a TPM, and a stage fails to hand off to the next',
  'fpga-bringup': 'Use when loading a bitstream onto a physical FPGA and driving or observing it over JTAG or GPIO, especially bit-banged JTAG from a host like a Raspberry Pi, or when configuration silently fails',
  'fpga-synthesis-fit': 'Use when synthesizing RTL to an FPGA with yosys/nextpnr (ECP5/Lattice and similar), fighting area or routing congestion, measuring Fmax, deciding why a design will not fit or route, or instantiating block RAM; covers the pre-pack vs post-pack metric trap',
  'hdl-module-design': 'Use when writing, refactoring, or deciding how to test an HDL module, component, or IP block (ROHD, Chisel, SpinalHDL, Verilog, VHDL) and you need it parameterized, validated, and covered by exhaustive tests rather than a one-off',
  'nix-eda-packaging': 'Use when packaging EDA or hardware toolchains in Nix (Yosys, OpenROAD, simulators, vendor tools) and hitting dlopen/plugin/runtime-path failures, or writing derivations and build phases for hardware tooling on aarch64-linux',
  'rohd-rtl-gotchas': 'Use when building or testing RTL in ROHD (Dart), rohd_bridge, or rohd_hcl and hitting hierarchy-violation errors, "Bad state: No element" at sim setup, co-simulation failures, SystemVerilog emission name mismatches, or unexpected register read latency',
  'rtl-area-timing': 'Use when optimizing RTL microarchitecture for area or clock frequency (Fmax), a design is too big to fit or too slow to meet timing, a wide multiply or barrel shifter is the critical path, or a "compute everything and select" datapath is too large',
  'silicon-grade-discipline': 'Use when writing hardware, firmware, verification, or tooling code that will reach real silicon, and you face a tradeoff between shipping fast and shipping correct; covers failures-should-fail, no over-engineering, no-panic, and test coverage',
  'soc-integration': 'Use when composing an SoC from peripherals and a bus fabric, or when generating device trees, ACPI tables, docs, or pin lists from a hardware description and they keep drifting out of sync',
  'tapeout-precheck': 'Use when preparing a design for tapeout or an MPW shuttle submission (wafer.space style), running DRC/LVS signoff, packaging the GDS, or deciding whether a physical-verification failure is safe to wave; covers metal-layer and std-cell rules',
  'systematic-debugging': 'Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes',
  'test-driven-development': 'Use when implementing any feature or bugfix, before writing implementation code',
  'brainstorming': 'Use before any creative work, creating features, building components, adding functionality, or modifying behavior',
  'verification-before-completion': 'Use when about to claim work is complete, fixed, or passing, before committing or creating PRs',
  none: 'No skill applies; answer the user directly.',
}

const CASES = [
  { tag: 'FLIP-target', prompt: 'I just need to write some unit tests for my Dart FIFO model, no errors yet, just want good coverage.', want: 'hdl-module-design' },
  { tag: 'regression-args', prompt: "I've got a parametrized arbiter in ROHD and its constructor takes nine separate int arguments. How should I clean this up?", want: 'hdl-module-design' },
  { tag: 'regression-reuse', prompt: 'What is a good way to structure a Verilog ALU so other projects can reuse it and I can trust it?', want: 'hdl-module-design' },
  { tag: 'GUARD-software-tdd', prompt: "I'm about to implement a new billing function in my Python service and want to do it test-first.", want: 'test-driven-development' },
]

const SCHEMA = { type: 'object', additionalProperties: false, required: ['pick'], properties: { pick: { type: 'string', enum: Object.keys(CATALOG) } } }
const catalogText = Object.entries(CATALOG).map(([n, d]) => `- ${n}: ${d}`).join('\n')
const routePrompt = (p) => `You are Claude Code deciding whether to invoke one skill, based ONLY on these trigger descriptions. Do not over-trigger; pick "none" if nothing fits.

AVAILABLE SKILLS:
${catalogText}

The user just sent:
"""
${p}
"""

Which single skill should you invoke? Pick the best match or "none".`

phase('Route')
const rows = await pipeline(CASES, async (c, _o, idx) => {
  const votes = await parallel(Array.from({ length: VOTES }, (_, v) => () =>
    agent(routePrompt(c.prompt), { label: `${c.tag}.${v}`, phase: 'Route', schema: SCHEMA })))
  const picks = votes.filter(Boolean).map((r) => r.pick)
  return { tag: c.tag, want: c.want, picks, hit: picks.filter((p) => p === c.want).length, n: picks.length }
}).then((r) => r.filter(Boolean))

log(rows.map((r) => `${r.tag}: ${r.hit}/${r.n} -> ${r.want}`).join(' | '))
return { rows, allPass: rows.every((r) => r.hit === r.n) }
