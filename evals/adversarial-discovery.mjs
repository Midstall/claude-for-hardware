export const meta = {
  name: 'adversarial-discovery',
  description: 'Hard discovery eval: keyword-bait near-misses, under-specified prompts that should stay quiet, multi-domain prompts, and process-skill collisions',
  phases: [{ title: 'Route', detail: 'router picks one skill (or none) per hard prompt, 3 votes each' }],
}

const VOTES = 3

const CATALOG = {
  'bare-metal-bringup': "Use when bringing up bare-metal or kernel code on a new architecture, SoC, or board (RISC-V, ARM, x86, ESP32) and it won't boot, hangs after boot, or faults early; covers trap vectors, MMU/PMP, syscall ABI, and boot ordering",
  'codegen-validation': 'Use when building or debugging a compiler backend, codegen, or assembler and you need to prove the generated machine code is correct by executing it on a real CPU or a fast emulator, not just inspecting the output',
  'differential-verification': 'Use when verifying a hardware DUT (a CPU core, FPGA, or netlist) against a golden reference model, building coverage-guided fuzzing, or detecting where silicon diverges from a simulator like Spike, an emulator, or SPICE',
  'firmware-boot-chain': 'Use when building or debugging a firmware and boot chain (RISC-V SBI, UEFI, ACPI, a bootloader handoff like Limine to an OS) or adding measured boot with a TPM, and a stage fails to hand off to the next',
  'fpga-bringup': 'Use when loading a bitstream onto a physical FPGA and driving or observing it over JTAG or GPIO, especially bit-banged JTAG from a host like a Raspberry Pi, or when configuration silently fails',
  'fpga-synthesis-fit': 'Use when synthesizing RTL to an FPGA with yosys/nextpnr (ECP5/Lattice and similar), fighting area or routing congestion, measuring Fmax, deciding why a design will not fit or route, or instantiating block RAM; covers the pre-pack vs post-pack metric trap',
  'hdl-module-design': 'Use when writing or refactoring an HDL module, component, or IP block (ROHD, Chisel, SpinalHDL, Verilog, VHDL) and you need it parameterized, validated, and testable rather than a one-off',
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

const HARDWARE = new Set(['bare-metal-bringup', 'codegen-validation', 'differential-verification', 'firmware-boot-chain', 'fpga-bringup', 'fpga-synthesis-fit', 'hdl-module-design', 'nix-eda-packaging', 'rohd-rtl-gotchas', 'rtl-area-timing', 'silicon-grade-discipline', 'soc-integration', 'tapeout-precheck'])

// kind: 'precision' (keyword bait, correct answer != obvious skill; trap = baited wrong pick)
//       'overtrigger' (under-specified / knowledge Q; a hardware pick is a failure)
//       'multidomain' (two skills both valid; report which and how consistent)
//       'collision' (hardware skill vs a superpowers process skill; both defensible)
const CASES = [
  // precision / near-miss: shares keywords with a skill but needs another (or none)
  { kind: 'precision', prompt: "yosys won't even install in my Nix shell, it's missing some dependency.", accept: ['nix-eda-packaging', 'none', 'systematic-debugging'], trap: 'fpga-synthesis-fit' },
  { kind: 'precision', prompt: 'My Spike reference simulator fails to compile from source.', accept: ['none', 'nix-eda-packaging', 'systematic-debugging'], trap: 'differential-verification' },
  { kind: 'precision', prompt: 'I just need to write some unit tests for my Dart FIFO model, no errors yet, just want good coverage.', accept: ['hdl-module-design', 'test-driven-development'], trap: 'rohd-rtl-gotchas' },
  { kind: 'precision', prompt: "What's the difference between AXI4 and Wishbone, conceptually?", accept: ['none'], trap: 'soc-integration' },
  { kind: 'precision', prompt: 'Recommend me a good FPGA dev board to buy for learning.', accept: ['none'], trap: 'fpga-bringup' },
  // overtrigger: vague or knowledge-only; ideal is to stay quiet / answer directly
  { kind: 'overtrigger', prompt: 'My chip is broken.', accept: ['none', 'systematic-debugging'], trap: null },
  { kind: 'overtrigger', prompt: 'Help me with my RISC-V CPU.', accept: ['none', 'brainstorming'], trap: null },
  { kind: 'overtrigger', prompt: 'Can you explain how an FPGA works under the hood?', accept: ['none'], trap: null },
  { kind: 'overtrigger', prompt: "I'm writing a blog post about the history of RISC-V.", accept: ['none'], trap: null },
  // multidomain: two skills genuinely apply; either is fine, watch consistency
  { kind: 'multidomain', prompt: 'My FPGA design barely fits, and when I do manage to flash it to the board it just hangs.', accept: ['fpga-synthesis-fit', 'fpga-bringup'], trap: null },
  { kind: 'multidomain', prompt: 'I want to verify my new codegen by running its output on my CPU core and diffing the result against Spike.', accept: ['codegen-validation', 'differential-verification'], trap: null },
  { kind: 'multidomain', prompt: 'Bringing up my new SoC: I still need to wire the peripherals together and the kernel also refuses to boot on it.', accept: ['soc-integration', 'bare-metal-bringup'], trap: null },
  { kind: 'multidomain', prompt: 'My multiplier is too slow and on top of that the whole design refuses to route past 90%.', accept: ['rtl-area-timing', 'fpga-synthesis-fit'], trap: null },
  // collision: hardware skill vs a superpowers process skill (process-first rule tension)
  { kind: 'collision', prompt: "My ROHD HDL test keeps failing and I genuinely can't tell why.", accept: ['rohd-rtl-gotchas', 'systematic-debugging'], trap: null },
  { kind: 'collision', prompt: 'My bare-metal RISC-V code has a bug, it crashes right at boot.', accept: ['bare-metal-bringup', 'systematic-debugging'], trap: null },
  { kind: 'collision', prompt: 'I want to comment out this one failing hardware-driver test to hit my demo deadline.', accept: ['silicon-grade-discipline'], trap: null },
]

const PICK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['pick', 'reasoning'],
  properties: {
    pick: { type: 'string', enum: Object.keys(CATALOG) },
    reasoning: { type: 'string' },
  },
}

const catalogText = Object.entries(CATALOG).map(([n, d]) => `- ${n}: ${d}`).join('\n')
const routePrompt = (p) => `You are Claude Code. Before responding to a user you decide whether to invoke one specialized skill. Decide based ONLY on the trigger descriptions below, matching them to what the user actually needs. Do not invent skills, and do not over-trigger: pick "none" if no skill genuinely fits or the request is too vague or is just a knowledge question.

AVAILABLE SKILLS:
${catalogText}

The user just sent:
"""
${p}
"""

Which single skill should you invoke before responding? Pick the best match or "none".`

phase('Route')
const routed = await pipeline(CASES, async (c, _o, idx) => {
  const votes = await parallel(Array.from({ length: VOTES }, (_, v) => () =>
    agent(routePrompt(c.prompt), { label: `${c.kind}#${idx}.${v}`, phase: 'Route', schema: PICK_SCHEMA })))
  const picks = votes.filter(Boolean).map((r) => r.pick)
  const distinct = [...new Set(picks)]
  return {
    kind: c.kind,
    prompt: c.prompt,
    picks,
    distinct,
    accepted: picks.filter((p) => c.accept.includes(p)).length,
    trapHits: c.trap ? picks.filter((p) => p === c.trap).length : 0,
    hwFired: picks.filter((p) => HARDWARE.has(p)).length,
    consistent: distinct.length === 1,
    n: picks.length,
  }
}).then((r) => r.filter(Boolean))

const byKind = {}
for (const r of routed) {
  const k = (byKind[r.kind] ||= { votes: 0, accepted: 0, trapHits: 0, hwFired: 0, consistentCases: 0, cases: 0 })
  k.votes += r.n; k.accepted += r.accepted; k.trapHits += r.trapHits; k.hwFired += r.hwFired
  k.cases += 1; if (r.consistent) k.consistentCases += 1
}

log(`Routed ${routed.length} adversarial cases x ${VOTES} votes`)

return {
  cases: routed.map((r) => ({ kind: r.kind, prompt: r.prompt, picks: r.picks, accepted: `${r.accepted}/${r.n}`, trapHits: r.trapHits, consistent: r.consistent })),
  byKind: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, {
    acceptRate: +(v.accepted / v.votes).toFixed(2),
    trapRate: +(v.trapHits / v.votes).toFixed(2),
    hwFiredVotes: v.hwFired,
    caseConsistency: `${v.consistentCases}/${v.cases}`,
  }])),
  summary: {
    overtriggerHardwareFires: (byKind.overtrigger?.hwFired ?? 0),
    precisionTrapRate: +((byKind.precision?.trapHits ?? 0) / (byKind.precision?.votes || 1)).toFixed(3),
    multidomainAcceptRate: +((byKind.multidomain?.accepted ?? 0) / (byKind.multidomain?.votes || 1)).toFixed(3),
  },
}
