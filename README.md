<div align="center">

# Coh Framework

**A multi-agent framework for vibe coding indie games.**

Build complete games through structured AI collaboration — from ideation to launch.

[Getting Started](#getting-started) · [Architecture](#architecture) · [Agents](#agents) · [Workflow](#workflow) · [Dogfooding](#dogfooding)

</div>

---

## What is this?

Coh is an opinionated framework that orchestrates multiple AI agents to develop indie games through a slice-based iterative process. It provides:

- **6 specialized agents** with defined roles, capabilities, and boundaries
- **A structured development model** (Ideation → Foundation → Slices → Polish → Launch)
- **Living documentation system** that stays synchronized with code
- **Quality gates and invariants** enforced at boot time
- **An art pipeline** for AI-generated asset post-processing and verification

The framework is designed for solo developers working with AI assistants (Claude Code, Cursor, or similar). It turns the chaotic "vibe coding" experience into a repeatable, auditable process without sacrificing creative agility.

## Getting Started

```bash
# Clone and start a new game project
git checkout -b my-game

# Talk to the ideation agent — describe your game idea
# It will guide you through 5 steps to produce docs/vision.md

# Then ask the director agent "what's next?"
# It will route you through Foundation → first Slice → iteration
```

See [`START-HERE.md`](START-HERE.md) for the full routing table.

## Architecture

```
.claude/agents/    Agent definitions (Claude Code runtime)
.cursor/agents/    Agent definitions (Cursor runtime) — body identical, model may differ
guides/            Human reference manuals (workflow docs, not consumed by agents)
tools/             Build-time utilities (art pipeline, parity checker)
data/              CSV tables — source of truth for game design data
CLAUDE.md          Framework rules (highest authority after agent definitions)
START-HERE.md      Human entry point
```

### Branch Convention

| Branch | Contains | Purpose |
|--------|----------|---------|
| `master` | Framework only | Agent definitions, guides, tools, templates |
| `<game-branch>` | Framework + game | Living docs, source code, game-specific config |

Framework changes land on `master` first, then propagate to game branches. Game code never flows back to `master`.

## Agents

| Agent | Role | Model Tier |
|-------|------|-----------|
| **ideation** | Extract core experience from vague ideas; produce vision.md | T1 (top) |
| **director** | Orchestrate the full process: plan slices, dispatch tasks, check consistency | T1 |
| **design** | Design systems, mechanics, numerical structures; guide rather than decide | T1 |
| **code** | Implement features; production quality from line one | T2 (mid) |
| **art** | Visual/audio direction; manage AI-generated assets via the art pipeline | T2 |
| **qa** | Verify spec conformance; find boundary-case bugs | T3 (budget) |

Model tiers are assigned by "can a machine catch the error?" — if downstream has automated gates (typecheck, lint, tests), the agent can run cheaper. If its output becomes source of truth for others, it must run at top tier.

## Workflow

### The Slice Model

```
Ideation → Foundation → Slice 1 → Slice 2 → ... → Polish → Launch
                         │
                         └── Design → Implement → Verify → Validate
```

Each slice:
- Has a **verification question** ("does this feel right?")
- Is **3–7 days** of work
- Produces a **playable increment**
- Ends with **human playtesting** (not just QA)

### Key Principles

- **No prototype phase** — first line of code is production quality
- **CSV-first data** — game design data (items, enemies, skills) lives in `data/*.csv`; code registries are generated, never hand-written
- **Spec maintenance protocol** — one system = one spec file, updated in place; git handles history
- **Change propagation** — structural changes must be traced across all affected documents
- **Model routing by escapability** — cheap models where machines catch errors, expensive where they can't

## The Art Pipeline

```bash
# Post-process AI-generated assets (palette quantization, brightness normalization)
npm run art:postprocess

# Verify assets meet art direction constraints
npm run art:verify
```

Located in `tools/art-pipeline/`. Self-contained, runs independently. Designed for the workflow: generate externally → post-process → verify → commit.

## Dogfooding

This framework is validated through an active game project on the `coh` branch — a top-down stealth survival game where a lone guardian maintains a purification point against encroaching corruption. The game serves as the framework's continuous integration test: every framework rule was earned through friction encountered while making a real game.

Completed slices:
1. **Rift stealth core** — movement, vision, AI, combat, chaos pressure
2. **Purification loop** — resource allocation, module repair, impact system
3. **Growth + tidal economy** — permanent upgrades, contaminant lifecycle, tidal pressure rhythm

## Configuration

### Agent Parity

Both `.claude/agents/` and `.cursor/agents/` must have identical body text. Only the `model` frontmatter field may differ (runtime-specific identifiers).

```bash
# Verify parity after any agent definition change
node tools/agent-parity/check.mjs
```

### Framework Iteration Protocol

- **Hot Fix** (≤5 min): framework rule blocking current work with obvious fix → fix immediately, note in `guides/98-field-notes.md`
- **Record & Continue**: friction felt but workaround exists → one-line note, keep working
- **Retrospective** (every 3 slices): consume field notes, categorize patterns, propose and execute fixes

## License

This framework is part of an active development project. License TBD.
