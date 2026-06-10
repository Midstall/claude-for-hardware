export const meta = {
  name: 'discovery-benchmark',
  description: 'Discovery eval: given only the trigger descriptions and a realistic prompt, does the right skill fire and resist competing process skills?',
  phases: [
    { title: 'Route', detail: 'router picks one skill (or none) per prompt, 3 votes each' },
  ],
}

const VOTES = 3

// The catalog the router sees: the REAL frontmatter descriptions of the 13
// hardware skills, plus the competing superpowers process skills that fight for
// the same prompts, plus an explicit "none". Discovery is a routing decision
// over exactly this text.
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
  // competing process skills (real superpowers skills)
  'systematic-debugging': 'Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes',
  'test-driven-development': 'Use when implementing any feature or bugfix, before writing implementation code',
  'brainstorming': 'Use before any creative work, creating features, building components, adding functionality, or modifying behavior',
  'verification-before-completion': 'Use when about to claim work is complete, fixed, or passing, before committing or creating PRs',
  none: 'No skill applies; answer the user directly.',
}

const HARDWARE = new Set([
  'bare-metal-bringup', 'codegen-validation', 'differential-verification', 'firmware-boot-chain',
  'fpga-bringup', 'fpga-synthesis-fit', 'hdl-module-design', 'nix-eda-packaging', 'rohd-rtl-gotchas',
  'rtl-area-timing', 'silicon-grade-discipline', 'soc-integration', 'tapeout-precheck',
])
const NON_HARDWARE = ['none', 'systematic-debugging', 'test-driven-development', 'brainstorming', 'verification-before-completion']

// primary = the ideal skill. accept = primary plus any genuinely defensible
// pick. Prompts are phrased naturally and avoid the skill's own keywords.
const CASES = [
  // hdl-module-design
  { group: 'hdl-module-design', prompt: "I've got a parametrized arbiter in ROHD and its constructor takes nine separate int arguments. Feels gross and error-prone. How should I clean this up?", primary: 'hdl-module-design', accept: ['hdl-module-design'] },
  { group: 'hdl-module-design', prompt: 'What is a good way to structure a Verilog ALU so other projects can reuse it and I can trust it?', primary: 'hdl-module-design', accept: ['hdl-module-design'] },
  // rohd-rtl-gotchas
  { group: 'rohd-rtl-gotchas', prompt: 'ROHD keeps throwing a hierarchy violation when I try to wire my testbench up to a behavioral flash model that shares a bidirectional bus.', primary: 'rohd-rtl-gotchas', accept: ['rohd-rtl-gotchas'] },
  { group: 'rohd-rtl-gotchas', prompt: "My Dart RTL simulation hangs right at startup with some 'No element' error and I can't tell why.", primary: 'rohd-rtl-gotchas', accept: ['rohd-rtl-gotchas'] },
  // soc-integration
  { group: 'soc-integration', prompt: 'Every time I add a peripheral I have to hand-edit both the RTL and the device tree, and they keep drifting apart. Is there a better way to organize this?', primary: 'soc-integration', accept: ['soc-integration'] },
  { group: 'soc-integration', prompt: 'I want to emit both ACPI tables and a device tree blob from one description of my chip. How should that be set up?', primary: 'soc-integration', accept: ['soc-integration'] },
  // rtl-area-timing
  { group: 'rtl-area-timing', prompt: 'My multiplier is the thing killing my clock speed on the FPGA. I tried registering its output but it barely moved. What now?', primary: 'rtl-area-timing', accept: ['rtl-area-timing', 'fpga-synthesis-fit'] },
  { group: 'rtl-area-timing', prompt: 'This instruction decoder that computes every opcode path in parallel and muxes the winner is way too big. How do I shrink it?', primary: 'rtl-area-timing', accept: ['rtl-area-timing'] },
  // fpga-synthesis-fit
  { group: 'fpga-synthesis-fit', prompt: "yosys reports my design at 80% but nextpnr just can't place and route it. What am I missing?", primary: 'fpga-synthesis-fit', accept: ['fpga-synthesis-fit'] },
  { group: 'fpga-synthesis-fit', prompt: 'My place-and-route has been churning for over an hour and the design will not converge on the Lattice part.', primary: 'fpga-synthesis-fit', accept: ['fpga-synthesis-fit'] },
  // fpga-bringup
  { group: 'fpga-bringup', prompt: "I'm programming a Lattice board over JTAG from a Raspberry Pi and nothing happens after I clock in the bitstream. The design just seems dead.", primary: 'fpga-bringup', accept: ['fpga-bringup'] },
  { group: 'fpga-bringup', prompt: 'I drive my FPGA inputs from GPIO lines and read outputs back, but the configuration appears to succeed while the logic never runs.', primary: 'fpga-bringup', accept: ['fpga-bringup'] },
  // bare-metal-bringup
  { group: 'bare-metal-bringup', prompt: 'My RISC-V kernel boots fine under QEMU but on the actual board it just hangs with no serial output at all.', primary: 'bare-metal-bringup', accept: ['bare-metal-bringup', 'firmware-boot-chain'] },
  { group: 'bare-metal-bringup', prompt: "I'm porting my little OS to a new ARM SoC and it faults somewhere before main even runs.", primary: 'bare-metal-bringup', accept: ['bare-metal-bringup'] },
  // firmware-boot-chain
  { group: 'firmware-boot-chain', prompt: 'Limine seems to load fine but my kernel never actually gets control. Where do I even start?', primary: 'firmware-boot-chain', accept: ['firmware-boot-chain', 'bare-metal-bringup'] },
  { group: 'firmware-boot-chain', prompt: 'I want to add a TPM and measured boot to my UEFI firmware so each stage attests the next.', primary: 'firmware-boot-chain', accept: ['firmware-boot-chain'] },
  // differential-verification
  { group: 'differential-verification', prompt: 'I want to throw random programs at my CPU core and check it behaves the same as Spike.', primary: 'differential-verification', accept: ['differential-verification'] },
  { group: 'differential-verification', prompt: 'My silicon gives different answers than my emulator on a few programs and I need to track down where they start to disagree.', primary: 'differential-verification', accept: ['differential-verification'] },
  // codegen-validation
  { group: 'codegen-validation', prompt: 'The assembly my compiler backend emits looks correct when I read it, but the program computes the wrong value at runtime.', primary: 'codegen-validation', accept: ['codegen-validation'] },
  { group: 'codegen-validation', prompt: 'How should I actually test that my instruction selection is correct, not just eyeball the output?', primary: 'codegen-validation', accept: ['codegen-validation'] },
  // tapeout-precheck
  { group: 'tapeout-precheck', prompt: "I'm getting DRC errors right before my shuttle deadline. Can I just suppress them to get a clean run?", primary: 'tapeout-precheck', accept: ['tapeout-precheck', 'silicon-grade-discipline'] },
  { group: 'tapeout-precheck', prompt: 'What do I need to verify and package before I send my GDS off to the foundry?', primary: 'tapeout-precheck', accept: ['tapeout-precheck'] },
  // nix-eda-packaging
  { group: 'nix-eda-packaging', prompt: "I'm packaging OpenROAD in Nix and at runtime it fails to dlopen one of its libraries. How do I fix this properly?", primary: 'nix-eda-packaging', accept: ['nix-eda-packaging'] },
  { group: 'nix-eda-packaging', prompt: 'How do I write a Nix derivation for Yosys that includes a plugin?', primary: 'nix-eda-packaging', accept: ['nix-eda-packaging'] },
  // silicon-grade-discipline
  { group: 'silicon-grade-discipline', prompt: "I'm tempted to wrap this flaky hardware-driver call in a retry-until-it-works loop in my Rust tool. Bad idea?", primary: 'silicon-grade-discipline', accept: ['silicon-grade-discipline'] },
  { group: 'silicon-grade-discipline', prompt: 'Is it fine to just panic when a register read comes back with an unexpected value in my verification tool?', primary: 'silicon-grade-discipline', accept: ['silicon-grade-discipline'] },
  // negatives: no hardware skill should fire
  { group: 'NEGATIVE', prompt: 'Can you help me rename a variable consistently across my Python project?', primary: 'none', accept: NON_HARDWARE },
  { group: 'NEGATIVE', prompt: 'Write me a haiku about transistors.', primary: 'none', accept: NON_HARDWARE },
  { group: 'NEGATIVE', prompt: 'My Node web server returns a 500 on POST requests, help me figure out why.', primary: 'systematic-debugging', accept: NON_HARDWARE },
  { group: 'NEGATIVE', prompt: "Let's design a new tagging feature for my note-taking web app.", primary: 'brainstorming', accept: NON_HARDWARE },
]

const PICK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['pick', 'reasoning'],
  properties: {
    pick: { type: 'string', enum: Object.keys(CATALOG), description: 'The single skill to invoke, or "none".' },
    reasoning: { type: 'string', description: 'One sentence on why, referencing the descriptions.' },
  },
}

const catalogText = Object.entries(CATALOG).map(([n, d]) => `- ${n}: ${d}`).join('\n')

function routePrompt(p) {
  return `You are Claude Code. Before responding to a user you decide whether to invoke one specialized skill. Decide based ONLY on the trigger descriptions below, matching them to what the user actually needs. Do not invent skills, and do not over-trigger: pick "none" if no skill genuinely fits.

AVAILABLE SKILLS:
${catalogText}

The user just sent:
"""
${p}
"""

Which single skill should you invoke before responding? Pick the best match or "none".`
}

phase('Route')
const routed = await pipeline(CASES, async (c, _orig, idx) => {
  const votes = await parallel(
    Array.from({ length: VOTES }, (_, v) => () =>
      agent(routePrompt(c.prompt), { label: `route:${c.group}#${idx}.${v}`, phase: 'Route', schema: PICK_SCHEMA }),
    ),
  )
  const picks = votes.filter(Boolean).map((r) => r.pick)
  const firedPrimary = picks.filter((p) => p === c.primary).length
  const accepted = picks.filter((p) => c.accept.includes(p)).length
  const hardwareFP = c.group === 'NEGATIVE' ? picks.filter((p) => HARDWARE.has(p)).length : 0
  return { group: c.group, prompt: c.prompt, primary: c.primary, picks, firedPrimary, accepted, hardwareFP, n: picks.length }
})

const cases = routed.filter(Boolean)

// per-skill aggregate over its (positive) cases
const bySkill = {}
for (const r of cases) {
  if (r.group === 'NEGATIVE') continue
  const s = (bySkill[r.group] ||= { primaryFires: 0, accepted: 0, votes: 0, picks: [] })
  s.primaryFires += r.firedPrimary
  s.accepted += r.accepted
  s.votes += r.n
  s.picks.push(...r.picks)
}

const skillRows = Object.entries(bySkill).map(([skill, s]) => {
  const wrong = s.picks.filter((p) => p !== skill)
  const confusion = {}
  for (const p of wrong) confusion[p] = (confusion[p] || 0) + 1
  return {
    skill,
    fireRate: +(s.primaryFires / s.votes).toFixed(2),
    acceptRate: +(s.accepted / s.votes).toFixed(2),
    votes: s.votes,
    confusedWith: Object.entries(confusion).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`),
  }
}).sort((a, b) => a.fireRate - b.fireRate)

const negatives = cases.filter((r) => r.group === 'NEGATIVE').map((r) => ({
  prompt: r.prompt,
  picks: r.picks,
  hardwareFalsePositives: r.hardwareFP,
}))

const totalPosVotes = Object.values(bySkill).reduce((a, s) => a + s.votes, 0)
const totalPrimary = Object.values(bySkill).reduce((a, s) => a + s.primaryFires, 0)
const totalAccept = Object.values(bySkill).reduce((a, s) => a + s.accepted, 0)
const totalNegFP = negatives.reduce((a, n) => a + n.hardwareFalsePositives, 0)
const totalNegVotes = negatives.reduce((a, n) => a + n.picks.length, 0)

log(`Routed ${cases.length} cases x ${VOTES} votes`)

return {
  perSkill: skillRows,
  negatives,
  summary: {
    exactFireRate: +(totalPrimary / totalPosVotes).toFixed(3),
    acceptRate: +(totalAccept / totalPosVotes).toFixed(3),
    negativeFalsePositiveRate: +(totalNegFP / totalNegVotes).toFixed(3),
    weakest: skillRows.slice(0, 3).map((r) => `${r.skill} (${r.fireRate})`),
  },
}
