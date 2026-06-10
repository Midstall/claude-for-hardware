export const meta = {
  name: 'skill-benchmark',
  description: 'Benchmark each claude-for-hardware skill: baseline vs skill-equipped agent on a river-derived problem, judged against ground truth',
  phases: [
    { title: 'Answer', detail: 'baseline (no skill) + treatment (skill applied) answer each scenario' },
    { title: 'Judge', detail: 'strict judge scores both arms against the oracle key points' },
  ],
}

const SKILLS_DIR = '/home/ross/Midstall/claude-for-hardware/skills'

// Each scenario: the skill under test, a realistic prompt, and the oracle
// (ground-truth key points distilled from the river / Midstall memory). The
// judge scores how many oracle points each arm actually states.
const SCENARIOS = [
  {
    skill: 'hdl-module-design',
    prompt: 'I am writing a synchronous FIFO module in ROHD (Dart). How should I structure its parameters and its tests so it is reusable and trustworthy?',
    oracle: [
      'One typed config object (const constructor, final fields), not a long positional list of int args',
      'Validate at construction with messages that name the offending field (e.g. depth must be a power of two)',
      'Derive dependent params (addrWidth) instead of making the caller pass them',
      'Use enums for modes/kinds, not magic strings',
      'Keep domain logic in the library; the CLI is a thin wrapper',
      'Test files mirror source layout (test/components/, test/config/); test each component standalone',
      'Sweep the parameter space and boundaries; cover that bad config actually throws',
    ],
  },
  {
    skill: 'rohd-rtl-gotchas',
    prompt: 'Two ROHD problems: (1) my sim throws "Bad state: No element" during Sequential setup, and (2) my SPI controller will not co-simulate against a behavioral SPI flash model that shares the bidirectional spi_io net (hierarchy violation). What is going on?',
    oracle: [
      '"Bad state: No element" is a clock problem, not where the trace points',
      'Cause A: Sequential clocked on a derived/gated clock; fix by clocking on the real system clock and detecting derived-clock edges manually (rising = clk & ~prevClk)',
      'Cause B: Simulator.reset() called between build() and run() kills the clock generator; only call it in tearDown',
      'inout co-sim between sibling modules is forbidden by the hierarchy checker',
      'Workaround: test a unidirectional path instead (drive MISO in standard mode procedurally)',
      'If you must share an inout, pass the SAME LogicNet to both modules addInOut; do not assign one onto the other',
    ],
  },
  {
    skill: 'soc-integration',
    prompt: 'My generated device tree and my RTL keep disagreeing about peripheral base addresses, and it bites me at runtime. How should I structure SoC integration so this cannot happen?',
    oracle: [
      'One neutral SoC description is the single source of truth',
      'Every generator (DTS, ACPI, docs) is a consumer of that description and never produces its own truth',
      'Generators must not import each other; they share the neutral type',
      'Peripherals are real modules (with bus interfaces / metadata), not parallel config lists that rot',
      'The peripheral-hosting object is per-instance, no global registry',
      'One address-map allocator validates overlaps at build time (overlap is a build error, not a runtime surprise)',
    ],
  },
  {
    skill: 'rtl-area-timing',
    prompt: 'On ECP5 my 64x64 multiply is the critical path. I registered the multiply output but Fmax barely improved. Separately, my microcoded decoder that computes every handler in parallel is too big. What do I do?',
    oracle: [
      'Registering only the output does NOT break the internal partial-product carry chain (operands-to-output is still the whole multiply)',
      'Pipeline the multiply INTERNALLY: decompose into smaller products (four 32x32), register the partials, sum shifted in a second registered stage, make it multi-cycle',
      'Registering inputs too gives diminishing returns; stop once the multiply leaves the critical path and re-read the report',
      'Decoder: remove unreachable/dead arms (e.g. byte/half memory-size cases for atomics that only exist at word/dword)',
      'Share a single resource (one ALU / one mem port) routed by control',
      'Do NOT source-level dedupe identical operand reads; yosys already CSEs them, so it is a no-op for area',
      'Diagnose with data (per-module cell counts, critical-path report) before optimizing',
    ],
  },
  {
    skill: 'fpga-synthesis-fit',
    prompt: 'A change cut my yosys LUT4 count by 10%, but the ECP5 design still will not route: nextpnr sits at ~91% and has thrashed for over an hour. How do I think about this?',
    oracle: [
      'Judge fit by post-pack nextpnr TRELLIS_COMB, never by pre-pack synth LUT4 (the metric trap)',
      'A change that cuts LUT4 can be neutral or worse for TRELLIS_COMB (barrel shifter vs mux tree)',
      'The router thrashes above ~85%; ~80% routes in minutes; keep BRAM under ~90% too',
      'SEEDS matter enormously: kill a thrashing route and try other seeds before changing RTL',
      'Watch the "overused" wire count trend toward 0 to know it is converging',
      'nextpnr --timing-allow-fail can emit a bit at a lower real clock',
    ],
  },
  {
    skill: 'fpga-bringup',
    prompt: 'I am bit-banging JTAG from a Raspberry Pi to load a bitstream onto an ECP5. The load "completes" but the design does not run, and configuration seems to silently fail. How do I debug this?',
    oracle: [
      'Prove the transport first: read IDCODE and confirm it matches the part before trusting anything',
      'Confirm the JTAG IR width matches the part; a wrong width shifts garbage and config silently no-ops',
      'Read back DONE/status after load; a clocked-but-ignored shift looks identical to a real one',
      'Use the Linux character-device GPIO (gpiod/cdev), not sysfs',
      'Check the bitstream clock is at or below real Fmax; a 48MHz bitstream on 29MHz silicon fails like a wiring fault (setup violations + wrong baud)',
      'Keep an explicit pad map (signal -> pad -> GPIO line); slow TCK until the link is proven',
    ],
  },
  {
    skill: 'bare-metal-bringup',
    prompt: 'I am bringing up a bare-metal RISC-V kernel on a new board. It boots but hangs immediately with no output. An earlier build panicked very early. How do I approach this?',
    oracle: [
      'Get one raw UART byte out first; until you have output you are debugging blind',
      'Work a checkpoint ladder in order (output, stack/BSS, trap vectors, timer, MMU/PMP, interrupts, userspace)',
      'Architectural timer init MUST run before any kernel timer that divides by its frequency, or you divide by zero and panic with no output',
      'Trap vector base alignment is part-specific (e.g. 256-byte, vectored forced); do not assume 4-byte slots',
      'Save/restore exactly what the ABI promises across trap/syscall entry',
      'A bug that only appears under KVM (not TCG) is usually a real save/ordering bug, not an emulator quirk',
    ],
  },
  {
    skill: 'firmware-boot-chain',
    prompt: 'I am chaining RISC-V firmware into Limine into a Linux kernel. Limine loads but the kernel never starts, or starts and faults. I also want to add measured boot with a TPM. How should I structure and debug this?',
    oracle: [
      'Map the handoffs first (ROM -> firmware -> bootloader -> kernel) and identify which arrow fails',
      'Each handoff has a register/pointer contract (RISC-V: a0=hartid, a1=DTB/ACPI pointer); get it exactly right',
      'Provide a platform description (DTB/ACPI) and probe peripherals from it rather than hardcoding addresses',
      'Bootloader gotchas: boot filesystem format (FAT16 not FAT32), menu timeout, ramdisk/module placement collisions',
      'Measured boot: extend the PCR with the next stage BEFORE transferring control (measure-then-transfer)',
      'Gate the TPM probe on the platform description advertising a TPM; test against swtpm first',
    ],
  },
  {
    skill: 'differential-verification',
    prompt: 'I am verifying the River CPU against Spike with a fuzzer. Random stimulus plateaus quickly, and sometimes a register clearly reads correctly on the DUT but the diff still reports a mismatch. How should this be built?',
    oracle: [
      'Same stimulus, two executors, compare state; confirm the stimulus was truly identical before trusting a mismatch',
      'Capture/compare register state by HARDWARE names (x0..x31, pc, raw CSR), not ABI names (a0/ra/sp) which are render-only',
      'A value read but recorded as absent/false is a false-pass/false-mismatch bug; verify captured fields are actually compared',
      'Use coverage-guided fuzzing with a novelty-favoring scheduler instead of pure random',
      'Layer the generator: a structured legal-code layer plus a raw corner-case encoder',
      'Find the FIRST diverging step, not just end state; the golden model is not automatically right',
    ],
  },
  {
    skill: 'codegen-validation',
    prompt: 'My RISC-V codegen backend emits assembly that looks correct when I read the disassembly, but it produces wrong answers at runtime. How do I validate codegen properly?',
    oracle: [
      'Execution-validate; reading the disassembly proves nothing',
      'Run the output on a real CPU or a fast emulator and assert the observed result, not "it did not crash"',
      'Use known-answer programs and order tests by capability (constant, args/ABI, stack frame, calls, control flow, spilling)',
      'When a higher test fails and lower ones pass, the bug is in the new capability',
      'This catches the bugs review misses: select/cmov lowering, critical-edge splitting, callee-saved/return-address save in prologue/epilogue, ABI register placement, relocations',
    ],
  },
  {
    skill: 'tapeout-precheck',
    prompt: 'DRC is failing right before my wafer.space submission deadline. I am thinking of setting ERROR_ON_DRC=false to get a clean pass, and I already flattened the standard cells and merged their metal layers to save area. Good plan?',
    oracle: [
      'No: a physical-verification failure means the design is wrong; fix the design, never disable the checker',
      'Disabling a rule ships a known defect as a green checkmark, the most dangerous output a flow can produce',
      'Never flatten and merge std-cell metal across cell boundaries: it shorts nets and breaks the device-to-net correspondence LVS relies on',
      'LVS must match exactly (no shorts, opens, or unintended merges)',
      'A legitimate waiver is foundry-granted in writing with rationale, not a flag flipped to hit a date',
      'Validate the submission package (top-cell name, layer map, metadata) against foundry spec',
    ],
  },
  {
    skill: 'nix-eda-packaging',
    prompt: 'My Yosys-with-a-plugin Nix build fails at runtime to dlopen the plugin .so. I plan to fix it with wrapProgram to set LD_LIBRARY_PATH, and I am also trying to bake $out into a build command via a toCommandLineShellGNU-style helper. Thoughts?',
    oracle: [
      'Do not use wrapProgram/patchelf/autoPatchelfHook to paper over a dlopen failure; that hides a real missing dependency',
      'Find what the tool actually dlopens and at what path, then provide it the way the tool expects (real search path / data dir / documented env), or put the lib on the proper rpath/buildInputs',
      'autoPatchelfHook patches NEEDED entries; it does not solve a runtime dlopen of a path you have not set up',
      'Reference $out INSIDE a buildPhase string; it is a build-time shell variable and cannot be threaded through a Nix-level CLI-arg helper',
      'The dev/build platform is aarch64-linux',
    ],
  },
  {
    skill: 'silicon-grade-discipline',
    prompt: 'A verification check is failing and I am on a deadline. I want to add a flag to skip it for now and wrap the operation in a retry-on-failure. There is also an unexpected state I am tempted to panic on. And I found the core updates page-table A/D bits in hardware, which I want to "fix" to fault instead. Advice?',
    oracle: [
      'Never add a knob that converts a real failure into a pass; fix the thing being checked',
      'Do not add preemptive recovery/retry scaffolding around an undiagnosed failure; a retry around corruption just corrupts more slowly. Diagnose root cause first',
      'Return typed errors for things that can fail in normal operation; reserve panic for genuinely impossible states',
      'Trust the logs; confirm a check actually ran rather than pattern-matching "0 errors"',
      'Spec may-vs-must: hardware A/D update is PERMITTED pre-Svade, so it is not a bug; making it strict is an ISA-policy choice, not a free correctness fix',
    ],
  },
]

const ANSWER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['answer'],
  properties: {
    answer: { type: 'string', description: 'Your concrete, specific answer to the scenario, as bullet points.' },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['keyPointsTotal', 'baselineHit', 'treatmentHit', 'baselineMissedButTreatmentGot', 'skillHelped', 'verdict'],
  properties: {
    keyPointsTotal: { type: 'integer' },
    baselineHit: { type: 'integer', description: 'How many oracle key points the baseline answer actually states.' },
    treatmentHit: { type: 'integer', description: 'How many oracle key points the treatment answer actually states.' },
    baselineMissedButTreatmentGot: { type: 'array', items: { type: 'string' }, description: 'Key points the skill arm got that the baseline missed.' },
    skillHelped: { type: 'boolean', description: 'Did the skill move the answer meaningfully toward the ground truth?' },
    verdict: { type: 'string', description: 'One sentence: did the skill earn its keep, is it redundant, or is the trigger/content weak?' },
  },
}

function baselinePrompt(s) {
  return `You are a senior hardware engineer. Answer this concretely and specifically, as bullet points.

IMPORTANT: Answer ONLY from your own knowledge. Do NOT read any files under ${SKILLS_DIR}. Do NOT invoke any Skill tool or load any skill. This is a control measurement of your unaided answer.

SCENARIO:
${s.prompt}`
}

function treatmentPrompt(s) {
  return `You are a senior hardware engineer. First, read this skill file and any sibling .md files in its directory:

  ${SKILLS_DIR}/${s.skill}/SKILL.md

Apply its guidance, then answer this scenario concretely and specifically, as bullet points.

SCENARIO:
${s.prompt}`
}

function judgePrompt(r) {
  return `You are a strict grader. Score two answers against a fixed list of ground-truth key points (distilled from a real RISC-V CPU project, "river"). An answer "hits" a key point only if it clearly and correctly states that idea; vague gestures do not count.

GROUND-TRUTH KEY POINTS (total ${r.s.oracle.length}):
${r.s.oracle.map((p, i) => `${i + 1}. ${p}`).join('\n')}

SCENARIO:
${r.s.prompt}

--- BASELINE ANSWER (no skill) ---
${r.baseline ? r.baseline.answer : '(no answer produced)'}

--- TREATMENT ANSWER (skill applied) ---
${r.treatment ? r.treatment.answer : '(no answer produced)'}

Grade strictly. Count hits for each arm against the ${r.s.oracle.length} key points. List the points the treatment arm got that the baseline missed. Decide whether the skill meaningfully helped.`
}

phase('Answer')
const results = await pipeline(
  SCENARIOS,
  async (s) => {
    const [baseline, treatment] = await parallel([
      () => agent(baselinePrompt(s), { label: `base:${s.skill}`, phase: 'Answer', schema: ANSWER_SCHEMA }),
      () => agent(treatmentPrompt(s), { label: `skill:${s.skill}`, phase: 'Answer', schema: ANSWER_SCHEMA }),
    ])
    return { s, baseline, treatment }
  },
  async (r) => {
    const verdict = await agent(judgePrompt(r), { label: `judge:${r.s.skill}`, phase: 'Judge', schema: VERDICT_SCHEMA })
    return { skill: r.s.skill, verdict }
  },
)

const rows = results.filter(Boolean).filter((r) => r.verdict).map((r) => ({
  skill: r.skill,
  total: r.verdict.keyPointsTotal,
  baseline: r.verdict.baselineHit,
  treatment: r.verdict.treatmentHit,
  delta: r.verdict.treatmentHit - r.verdict.baselineHit,
  helped: r.verdict.skillHelped,
  gained: r.verdict.baselineMissedButTreatmentGot,
  verdict: r.verdict.verdict,
}))

rows.sort((a, b) => b.delta - a.delta)

log(`Scored ${rows.length}/${SCENARIOS.length} skills`)

return {
  ranked: rows,
  summary: {
    skillsHelped: rows.filter((r) => r.helped).length,
    avgDelta: rows.length ? rows.reduce((a, r) => a + r.delta, 0) / rows.length : 0,
    redundant: rows.filter((r) => r.delta <= 0).map((r) => r.skill),
  },
}
