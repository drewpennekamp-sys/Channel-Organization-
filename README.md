# RC Livery Lab — Phase 1: the geometry engine

AI livery designer + automatic Cricut cut-file generator for 1/10 scale RC
bodies. This repository currently implements **Phase 1 only**, per the
build spec: the deterministic geometry engine, with no UI, database, or
API route yet. Everything here is a pnpm monorepo of TypeScript packages,
driven from the CLI / test suite.

See `docs/rc-livery-lab-build-spec.md` for the full multi-phase plan. The one-sentence version: an LLM emits a
structured `DesignSpec` JSON (never raw SVG), and this engine turns that
into cut-ready per-colour SVG, DXF, and a paint-order guide — the mockup
you show a customer and the file you cut come from the same geometry, so
they can't drift.

## Packages

| Package | What it is |
|---|---|
| `packages/schema` | Zod schemas for the Body Template Format (BTF) and DesignSpec v1 — the two JSON contracts everything else is built on. |
| `packages/bodies` | BTF loader + structural/semantic validator + panel-mirror resolution. |
| `packages/elements` | The parametric element vocabulary the AI composes with — 6 generators in v1: `slash-tear`, `chevron-arrow`, `stripe-jagged`, `banner-curved`, `text-block`, `ribbon-awareness`. `text-block`/`banner-curved` convert glyphs to real paths via `opentype.js` — never `<text>`. |
| `packages/geometry` | The 10-stage pipeline: resolve → transform → group-by-colour → boolean union (Clipper2/WASM) → validate (min-width, gap, margin, node-count) → auto-bridge floating islands → mirror-for-inside-Lexan → nest onto a 12×24in mat → registration marks → export (Cricut-safe SVG, DXF via maker.js, markdown spray guide). |

`content/bodies/protoform-1567-00.btf.json` is the seed body — a
PROTOform 1971 Camaro Z28 with **real measured overall dimensions** from
the vendor spec sheet. Its per-panel outlines are still geometric
approximations (see the `notes` field in that file) pending a physical
trace, so it ships `status: "draft"`.

## Getting started

```bash
pnpm install
pnpm test          # full unit + integration + golden-file suite
pnpm typecheck      # tsc --noEmit across every package
pnpm cut-test-sheet  # emits output/cut-test-sheet.svg — 0.8/1.0/1.2/1.5/2.0mm
                     # calibration bars; cut it on your actual Cricut to find
                     # your machine's real minimum before trusting the
                     # 1.2mm default in packages/geometry/src/validate.ts
```

The best single demonstration of the whole pipeline is
`packages/geometry/test/pipeline.test.ts`, which runs a real DesignSpec
fixture (`packages/geometry/test/fixtures/camaro-bearcat-claw.json`)
against the Camaro BTF and asserts:

- no validation issues (min-width / gap / panel-margin / node-count / floating-island)
- every exported SVG passes the full Cricut-safe checklist (§3.5 of the spec)
- every exported DXF carries the right `MASK_<COLOUR>` + `REGISTRATION` layers
- the spray guide's paint order is correct for inside-Lexan application
  (first-sprayed = most visible; masks stay on until the very last detail
  colour; the backing coat goes on unmasked, last)
- golden-file snapshots of the actual cut geometry, so a refactor can't
  silently change what gets cut (`packages/geometry/test/__snapshots__/`)

**Done when:** you cut `output/cut-test-sheet.svg` on your actual Cricut
and it weeds cleanly — that's the real Phase 1 acceptance test, not
anything in this repo.

## What's deliberately not here yet

No Next.js app, database, or API route — those are Phases 2-5 of the
build spec (renderer + marketing site, AI composer, orders, polish).
Nothing in `packages/*` depends on any of that; the geometry engine is a
pure, framework-free TypeScript library on purpose.
