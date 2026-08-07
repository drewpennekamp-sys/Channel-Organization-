# RC Livery Lab — Build Specification

**Handoff document for Claude Code.** Working name: `livery-lab`. Public storefront + AI livery designer + automatic Cricut cut-file generator for 1/10 scale RC bodies.

---

## 0. Read this first — the one decision that shapes everything

The naive build is: *AI generates a picture → trace the picture → cut it.* **Do not build that.** Raster tracing produces jagged paths, thousands of nodes, sub-millimetre slivers, and floating islands. It will fail on a Cricut and it will waste vinyl.

Build this instead:

```
User brief ──▶ LLM ──▶ DesignSpec JSON ──▶ Geometry Engine ──┬──▶ Mockup render (SVG/PNG)
              (text)   (structured,        (deterministic)   ├──▶ Cut sheet (SVG, per colour)
                        validated)                            ├──▶ DXF
                                                              └──▶ Paint-order guide
```

**One geometry source, two outputs.** The mockup you show the customer and the file you cut are generated from the same paths. They cannot drift. Cut validity is guaranteed at generation time, not discovered at cut time.

Raster image generation is a **separate, optional, marketing-only path** (§9). It never feeds the cutter.

---

## 1. Product definition

| | |
|---|---|
| **Who it's for** | 1/10 RC drift and on-road racers who paint the inside of clear Lexan bodies and want zero stickers |
| **Job of the site** | Turn "I want a Formula-D style livery on my '71 Camaro in white/black/red" into a cut-ready mask set and a paid order |
| **Primary output** | Per-colour mirrored SVG + master SVG + DXF, nested on a 12×24 in mat, plus a numbered spray-order guide |
| **Payment** | External (Etsy). Site never touches card data. |
| **Non-goals v1** | User accounts with social features, 3D preview, marketplace of other people's designs, mobile app |

### The three user paths

1. **Browse → buy a stock livery.** Pre-made designs per body. Fastest to revenue, build first.
2. **Design → generate → buy.** AI composer, the headline feature.
3. **Upload → quote.** Customer sends their own artwork, you quote manually. Escape hatch, low code.

---

## 2. Core domain concepts

### 2.1 Body Template Format (BTF)

Every supported body gets one JSON file. This is your moat — it is measured data, not AI output.

```jsonc
// content/bodies/protoform-1567-00.btf.json
{
  "id": "protoform-1567-00",
  "manufacturer": "PROTOform",
  "name": "1971 Chevrolet Camaro Z28",
  "partNumber": "1567-00",
  "scale": "1/10",
  "class": "on-road",
  "dimensionsMm": {
    "length": 489, "widthFront": 195, "widthRear": 195,
    "height": 112, "wheelbase": 272,
    "frontOverhang": 80, "rearOverhang": 137,
    "trackWidth": 195, "roofWidth": 183
  },
  "bodyWeightG": 160,
  "material": "clear-polycarbonate",

  // Flat developable panels. Each is a closed polygon in mm, origin top-left of that panel.
  // Derived by measuring a trimmed body flat, or by unwrapping the vendor spec sheet.
  "panels": [
    {
      "id": "side-left",
      "label": "Left side",
      "widthMm": 489, "heightMm": 112,
      "outline": "M0,0 L489,0 L489,112 L0,112 Z",   // real outline, not a rect
      "cutouts": [
        { "id": "wheel-arch-front", "d": "M78,112 a34,34 0 0 1 68,0 Z" },
        { "id": "wheel-arch-rear",  "d": "M350,112 a36,36 0 0 1 72,0 Z" }
      ],
      "curvature": "low",          // low | medium | high  → drives max element size
      "mirrorOf": null
    },
    { "id": "side-right", "mirrorOf": "side-left" },
    { "id": "hood",  "widthMm": 195, "heightMm": 140, "curvature": "medium", "outline": "..." },
    { "id": "roof",  "widthMm": 183, "heightMm": 120, "curvature": "medium", "outline": "..." },
    { "id": "trunk", "widthMm": 195, "heightMm": 110, "curvature": "medium", "outline": "..." },
    { "id": "front-fascia", "curvature": "high", "outline": "..." },
    { "id": "rear-fascia",  "curvature": "high", "outline": "..." }
  ],

  // Views used to composite the mockup. Each maps a panel into the illustration.
  "views": [
    {
      "id": "side",
      "artwork": "/bodies/protoform-1567-00/view-side.svg",  // clear-body line art
      "panelMap": [
        { "panel": "side-left", "transform": "matrix(1,0,0,1,40,180)", "warp": "none" }
      ]
    },
    { "id": "top",   "artwork": "...", "panelMap": [ { "panel": "hood", "..." }, { "panel": "roof", "..." } ] },
    { "id": "front", "artwork": "...", "panelMap": [ /* ... */ ] },
    { "id": "rear",  "artwork": "...", "panelMap": [ /* ... */ ] },
    { "id": "hero-3q", "artwork": "...", "panelMap": [ /* ... */ ] }
  ],

  "notes": "Rear overhang is long; avoid placing text past x=420 on sides.",
  "status": "verified"   // draft | verified — only verified bodies are purchasable
}
```

**Seed the catalogue with two verified bodies:**

| Body | Part | Length | Width F/R | Height | Wheelbase | Notes |
|---|---|---|---|---|---|---|
| PROTOform 1971 Camaro Z28 | 1567-00 | 489 mm | 195 / 195 | 112 mm | 272 mm | Roof width 183 mm, F overhang 80, R overhang 137 |
| Addiction RC Toyota A90 Supra GR HYCADE | — | — | 208 / 208 | — | 258 mm | Measure and fill remaining dims |

Everything else ships as `status: "draft"` and is not purchasable until measured.

### 2.2 Element Library

The vocabulary the AI composes with. Each element is a parametric SVG path generator, **not** a static file. Reference the uploaded cancer-awareness sheet: that is exactly the element vocabulary.

```ts
// packages/elements/src/types.ts
export interface ElementDef {
  id: string;                    // "slash-tear", "chevron-double", "ribbon-awareness"
  category: 'slash' | 'chevron' | 'stripe' | 'banner' | 'badge' | 'text' | 'geometric';
  params: ZodSchema;             // validated params
  generate(p: Params): PathSet;  // → { fills: string[], minFeatureMm: number }
  minSizeMm: number;             // below this it violates the 1.2 mm rule
  supportsText: boolean;
  tags: string[];                // "aggressive", "motorsport", "retro", "clean"
}
```

**Ship these 14 in v1** (covers the uploaded sheet plus standard drift liveries):

| id | Category | Key params | Notes |
|---|---|---|---|
| `slash-tear` | slash | lengthMm, widthMm, jaggedness, seed | The core "claw rip" shape |
| `slash-burst` | slash | count, spread, lengthMm | Radiating group |
| `chevron-arrow` | chevron | armLengthMm, angleDeg, thicknessMm, jagged | The big arrow shapes |
| `stripe-straight` | stripe | lengthMm, widthMm, taper | Simple racing stripe |
| `stripe-jagged` | stripe | lengthMm, widthMm, teeth, seed | The wide zigzag band |
| `stripe-dual` | stripe | gapMm, count | The paired black bars |
| `banner-curved` | banner | text, radiusMm, heightMm, invert | Windshield-style curved text plate |
| `banner-pill` | banner | text, cornerRadiusMm | "HOPE • FIGHT • STRENGTH" |
| `badge-shield` | badge | widthMm, heightMm, warp | Door-plate shapes |
| `ribbon-awareness` | badge | heightMm, tailStyle | Awareness ribbon |
| `text-block` | text | text, font, sizeMm, arc, outline | Converted to paths always |
| `panel-fade` | geometric | direction, steps, stepWidthMm | Halftone/stepped fade in cut-safe bars |
| `grid-dither` | geometric | cellMm, density, seed | Cut-safe dither |
| `number-roundel` | badge | number, diameterMm | Race number |

**Rules every generator must obey:**
- Emit closed subpaths only. No strokes anywhere in the output.
- Expose `minFeatureMm` computed from actual geometry, not from params.
- Deterministic given `(params, seed)`.
- Return geometry in millimetres in panel space.

### 2.3 DesignSpec — the JSON the AI emits

This is the contract. The LLM never writes SVG, never writes coordinates it invented; it writes this and the engine does the rest.

```jsonc
{
  "version": 1,
  "bodyId": "protoform-1567-00",
  "name": "Bearcat Claw",
  "palette": {
    "base":   { "name": "White",  "hex": "#FFFFFF", "paintCode": "Tamiya PS-1" },
    "c1":     { "name": "Black",  "hex": "#111111", "paintCode": "Tamiya PS-5" },
    "c2":     { "name": "Red",    "hex": "#C8102E", "paintCode": "Tamiya PS-34" }
  },
  // Inside-Lexan: index 0 is sprayed FIRST and is the colour you SEE on top.
  "paintOrder": ["c2", "c1", "base"],
  "placements": [
    {
      "id": "p1",
      "panel": "side-left",
      "element": "slash-tear",
      "colour": "c1",
      "params": { "lengthMm": 120, "widthMm": 18, "jaggedness": 0.7, "seed": 4412 },
      "xMm": 210, "yMm": 34, "rotationDeg": -12, "mirror": false
    },
    {
      "id": "p2",
      "panel": "side-left",
      "element": "text-block",
      "colour": "c1",
      "params": { "text": "CINCINNATI", "font": "Anton", "sizeMm": 22, "outline": false },
      "xMm": 300, "yMm": 52, "rotationDeg": 0
    }
  ],
  "autoMirror": ["side-left→side-right"],
  "rationale": "Claw slashes read as motion at speed; text sits above the rear arch where curvature is lowest."
}
```

**Validation before anything renders** (Zod + custom rules):
1. `bodyId` exists and is `verified`.
2. Every `panel` exists in that BTF.
3. Every `element` exists in the library; params pass its schema.
4. Every `colour` key exists in `palette`.
5. `paintOrder` contains every palette key exactly once.
6. Element bounding box, after rotation, lies inside `panel.outline` minus `cutouts` with ≥3 mm margin.
7. `params` size ≥ `element.minSizeMm`.

Validation failures go back to the LLM as a repair prompt (max 2 retries), then surface a plain-language error to the user.

---

## 3. The geometry engine

`packages/geometry` — pure TypeScript, zero React, fully unit-tested. **This is the highest-value code in the repo. Build it first, before any UI.**

### 3.1 Pipeline

```
DesignSpec
  │
  ├─ 1. resolve()      element defs + params → PathSet per placement (mm, panel space)
  ├─ 2. transform()    rotate, translate, apply autoMirror
  ├─ 3. groupByColour() → one geometry set per palette colour
  ├─ 4. boolean()      union overlapping same-colour shapes (clipper union)
  ├─ 5. validate()     min-width · island · margin checks  → issues[]
  ├─ 6. bridge()       auto-insert bridges for floating islands
  ├─ 7. mirrorX()      whole sheet flipped for inside-Lexan application
  ├─ 8. nest()         pack onto 12×24 mat with kerf gap
  ├─ 9. addRegistration()
  └─ 10. export()      SVG per colour · master SVG · DXF · spray guide
```

### 3.2 Validation rules

| Rule | Threshold | Method | On failure |
|---|---|---|---|
| Min cut width | 1.2 mm | Morphological opening: offset −0.6 mm then +0.6 mm. Any region that vanishes was too thin. | Flag region; auto-thicken by scaling element up, or drop element |
| Min gap between shapes | 1.2 mm | Offset +0.6 mm on all shapes; any new intersection = gap too small | Nudge or merge |
| Floating island | any | Build containment tree via point-in-polygon; a subpath at even nesting depth ≥2 with no connection to the frame is floating | Auto-bridge |
| Panel margin | 3 mm | Bounding check against `outline` minus `cutouts` | Reposition or reject |
| Node count | ≤ 1500 per colour layer | Count after simplification | Simplify tolerance 0.05 mm |
| Sheet fit | 290 × 590 mm safe area | Nesting result | Split across additional sheets |

**Bridging algorithm:** for each floating island, find the shortest segment from island boundary to the nearest non-island boundary of the same colour, and subtract a 1.5 mm-wide rectangle along that segment from the *surrounding* shape, welding them. Prefer bridges that run along the low-visibility axis (vertical on sides, front-to-back on hood). Cap at 3 bridges per shape; beyond that, mark the shape as "needs manual attention."

### 3.3 Registration marks

Multi-layer masking needs alignment between layers on the body, not on the mat.

- Every colour layer gets the **same 4 marks**: 6 mm crosses with 1.5 mm arms, placed at fixed absolute panel coordinates.
- Marks are **asymmetric** — three at 90° corners, one offset 12 mm inboard — so a flipped layer is immediately obvious.
- Each layer also carries a **frame outline**: a 1 mm-wide open rectangle matching the panel bounding box, cut but discarded, used to eyeball alignment against the body edge.
- Marks are tagged `data-role="registration"` so they can be toggled off.

### 3.4 Nesting

- Mat: 12 × 24 in = 304.8 × 609.6 mm. **Safe area 290 × 590 mm.**
- Algorithm: bounding-box first-fit-decreasing with 90° rotation allowed, 3 mm gutter. Do not build true no-fit-polygon nesting in v1.
- One sheet **per colour** by default (simpler weeding), with an "economy mode" that packs all colours on one sheet using distinct fill colours.
- Overflow spawns `sheet-2`, `sheet-3`.

### 3.5 Cricut-safe SVG export

Design Space is picky. The exporter must guarantee:

```
✓ viewBox in px at 96 dpi, width/height attributes in mm  (1 mm = 3.7795275591 px)
✓ Every shape is <path> with fill only — no stroke, no stroke-width
✓ All transforms flattened into path data (no transform= attributes)
✓ No <text>, <tspan>, <image>, <use>, <clipPath>, <mask>, <filter>
✓ One <g id="layer-{colour}" fill="{hex}"> per colour — Design Space splits on fill colour
✓ fill-rule="evenodd" explicit on every path
✓ Absolute path commands only (M/L/C/Z), 3 decimal places
✓ No <style> blocks, no CSS classes
✓ Document units: mm, no percentage dimensions
```

Run `svgo` with a locked config, then a custom post-pass to re-add the required attributes svgo strips.

### 3.6 DXF export

Use `maker.js` for the model → DXF conversion. Units: millimetres. One DXF **layer** per colour, named `MASK_{COLOUR}`. Arcs converted to polylines at 0.05 mm chord tolerance. Include a `REGISTRATION` layer.

### 3.7 Spray guide generation

From `paintOrder`, emit a numbered markdown/PDF guide:

```
Step 1 — Prep: wash inside with dish soap, dry, tack cloth. Do not touch.
Step 2 — Apply layer RED (mask-01-red.svg). Align crosses to body edge.
Step 3 — Spray Tamiya PS-34 Bright Red. 3 light coats, 10 min between.
Step 4 — Apply layer BLACK (mask-02-black.svg) OVER the red masks. Do not remove red masks.
...
Final — Remove all masks. Backing coat white over everything.
```

The engine knows which masks stay on and which come off — encode that in the guide, it is the #1 thing beginners get wrong.

---

## 4. Site map

```
/                          Homepage — hero, how it works, body catalogue, gallery, CTA
/bodies                    Supported bodies grid (verified + coming soon)
/bodies/[id]               Body detail: dims table, panel diagram, liveries for it
/design                    The Designer (the main event)
/design/[shareId]          Public read-only view of a saved design
/gallery                   Stock liveries, filterable by body/style/colour
/orders/[token]            Order status + downloads after fulfilment
/how-it-works              Application tutorial, paint order, tools needed
/faq                       Sizing, paints, shipping, returns
/about                     Your story — this is a solo-maker brand, use it
```

### The Designer (`/design`) — 4-step flow

| Step | Screen | Detail |
|---|---|---|
| 1 | **Pick a body** | Card grid, search, "request a body" link. Sets BTF context. |
| 2 | **Describe it** | Free-text brief + colour picker (max 4) + style chips (aggressive / retro / clean / motorsport / awareness) + optional text fields (sponsor names, race number). "Surprise me" button. |
| 3 | **Review** | Live multi-view mockup (side / top / front / rear), placement list with drag-to-move and per-element edit, "Regenerate", "Regenerate this panel only". Validation issues shown inline with plain-English fixes. |
| 4 | **Order** | Sheet preview, sheet count, price breakdown, material choice, then handoff to checkout. |

**Editor requirements:** SVG canvas with pan/zoom, click-to-select placement, drag to move (snap to 1 mm), rotate handle, delete, duplicate, mirror-to-other-side toggle, z-order within colour. Undo/redo via a simple command stack on `DesignSpec`. Persist to `localStorage` every change plus server autosave on debounce.

---

## 5. Visual direction

The subject's world is spray cans, masking film, Lexan, and mat-cut vinyl. Do not build a generic SaaS landing page.

**Palette** — derived from a shop, not a dashboard:

| Token | Hex | Use |
|---|---|---|
| `--film` | `#E8E6E1` | Page base — the colour of masking film, slightly warm grey |
| `--lexan` | `#0B0C0E` | Text and heavy surfaces |
| `--tape` | `#F2C230` | Signature accent — masking-tape yellow, used sparingly |
| `--overspray` | `#8A8F98` | Secondary text, rules |
| `--cut` | `#00B3A4` | Interactive/active state (echoes the teal reference sheet) |

Avoid: cream `#F4F1EA` + terracotta, near-black + acid green, broadsheet hairline columns. Those are the current AI-design defaults and will read as templated.

**Type:** display face with real width and attitude — `Anton` or `Archivo Expanded` for headlines, set tight and large. Body in `Inter Tight`. Data and dimension tables in `IBM Plex Mono` — dimensions are engineering data and should look like it.

**Signature element:** the homepage hero is a **live cut-sheet**. Not a photo of a car. An animated SVG of a mask sheet where the cut lines draw themselves in (`stroke-dasharray` reveal), then the pieces lift and settle onto a body silhouette. It states the whole product in one motion. Respect `prefers-reduced-motion` with a static final frame.

**Structural device:** every body page shows the real dimension table in mono type, straight from the BTF. Numbers are the brand. Don't decorate with numbered `01 / 02 / 03` markers unless the content is genuinely sequential — the paint-order guide is, the feature list isn't.

**Copy voice:** plain, shop-floor, specific. "Cut on a 12×24 mat" not "Precision-engineered manufacturing." Buttons say what happens: "Generate livery", "Download cut files", "Order this set".

---

## 6. Data model

```prisma
model Body {
  id            String   @id            // "protoform-1567-00"
  manufacturer  String
  name          String
  partNumber    String?
  scale         String
  status        BodyStatus @default(DRAFT)
  btf           Json                     // the full BTF document
  heroImage     String?
  designs       Design[]
  createdAt     DateTime @default(now())
}

model Design {
  id            String   @id @default(cuid())
  shareId       String   @unique          // short public slug
  bodyId        String
  body          Body     @relation(fields: [bodyId], references: [id])
  name          String
  spec          Json                      // DesignSpec
  previewUrl    String?                   // rendered PNG in object storage
  isStock       Boolean  @default(false)  // your curated liveries
  isPublic      Boolean  @default(false)
  authorEmail   String?
  orders        Order[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Order {
  id             String      @id @default(cuid())
  token          String      @unique      // emailed status/download link
  designId       String
  design         Design      @relation(fields: [designId], references: [id])
  status         OrderStatus @default(AWAITING_PAYMENT)
  provider       String                    // "etsy"
  providerRef    String?                   // Etsy order number, entered by you
  customerEmail  String
  material       String                    // "oramask-810" | "vinyl-651"
  sheetCount     Int
  priceCents     Int
  artifacts      Json?                     // { svgUrls, dxfUrl, guideUrl }
  notes          String?
  createdAt      DateTime @default(now())
}

enum BodyStatus  { DRAFT VERIFIED RETIRED }
enum OrderStatus { AWAITING_PAYMENT PAID CUTTING SHIPPED CANCELLED }
```

---

## 7. Checkout adapter (Etsy path deferred)

**Do not hardcode Etsy.** Define the interface now, ship the simplest implementation.

```ts
export interface CheckoutProvider {
  id: string;
  createHandoff(order: Order, design: Design): Promise<{
    url: string;                 // where to send the buyer
    instructions: string[];      // what to paste where
    reference: string;           // the code that ties payment back to the order
  }>;
}
```

**v1 implementation — `EtsyLinkProvider`:**
1. Order row created with `status: AWAITING_PAYMENT` and a short reference like `LL-8K3Q`.
2. User is shown: the reference code, a "Copy code" button, and a "Continue to Etsy" button.
3. Etsy listing URL comes from an env var, with the quantity = sheet count where possible.
4. Instruction copy tells them to paste `LL-8K3Q` into Etsy's personalization field.
5. You mark the order `PAID` from a simple `/admin/orders` page after Etsy notifies you. No Etsy API in v1.
6. Marking `PAID` triggers artifact generation + an email with the download link.

Leave `StripeProvider` as a stubbed file with a TODO. Swapping later touches one module.

**Blocked until you decide:** listing structure (one generic vs per-body), pricing tiers, whether files are delivered digitally, physically cut by you, or both. Build the pricing as a config file so it's a one-line change:

```ts
// config/pricing.ts
export const PRICING = {
  currency: 'usd',
  baseSheetCents: 1800,
  extraSheetCents: 1200,
  materials: { 'oramask-810': 0, 'vinyl-651': -300 },
  digitalOnlyCents: 900,
};
```

---

## 8. AI layer

```ts
export interface DesignBrain {
  compose(input: {
    body: BodyTemplate;
    brief: string;
    palette: Colour[];
    style: StyleTag[];
    textFields: Record<string, string>;
    elementCatalogue: ElementSummary[];
  }): Promise<DesignSpec>;
}
```

**Implementation `ClaudeDesignBrain`:** single call to the Anthropic Messages API. System prompt contains the full element catalogue with param schemas and the target BTF panel dimensions. Instruct: return **only** JSON matching the DesignSpec schema, no prose, no markdown fences. Parse, validate, and on failure send the validation errors back as a repair turn (max 2).

**Prompt skeleton to build from:**

```
You are a livery designer for 1/10 scale RC bodies. You compose designs ONLY by
placing elements from the catalogue below onto flat body panels.

BODY: {name}, panels: {panel list with widthMm × heightMm and curvature}
ELEMENT CATALOGUE: {id, category, params with ranges, minSizeMm, tags}
PALETTE: {colour keys, names, hex}
BRIEF: {user text}
STYLE: {tags}

RULES
- Output a single JSON object matching DesignSpec v1. No other text.
- Keep every element at least 3 mm inside its panel outline.
- Never place elements smaller than the element's minSizeMm.
- On high-curvature panels use only elements tagged "conformable".
- paintOrder must list every palette key exactly once, first = most visible.
- Mirror side panels via autoMirror unless the brief asks for asymmetry.
- Aim for 8–20 placements. Restraint reads better at scale than density.
```

**Raster image generation — deferred and optional.** Since ChatGPT Pro gives you no key, structure it as:

```ts
export interface ImageProvider { generate(prompt: string): Promise<Buffer>; }
```

with three implementations: `NullImageProvider` (default — mockups come from the SVG renderer, which is better anyway), `ManualUploadProvider` (you upload concept art in admin), and a stubbed `OpenAIImageProvider` for later. **Nothing in the purchase flow may depend on raster generation.** When you're ready, the cheapest options to compare are Google Gemini image models, OpenAI images via `platform.openai.com` (separate signup and billing from your Pro subscription), and Replicate for open models.

---

## 9. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript strict | Server actions keep API keys server-side |
| Styling | Tailwind + CSS variables for the token set | Tokens in §5 as CSS vars, not Tailwind config guesses |
| UI primitives | shadcn/ui, used sparingly | Don't let it dictate the look |
| DB | Postgres (Neon or Supabase) + Prisma | Cheap, serverless-friendly |
| Object storage | Cloudflare R2 (S3 API) | Cut files and previews; egress-free |
| Geometry booleans | `js-angusj-clipper` (WASM Clipper2) | Offsetting for min-width and gap checks |
| SVG model + DXF | `maker.js` | Solid DXF export, mm-native |
| SVG optimisation | `svgo` with locked config | Then a custom post-pass |
| Raster preview | `sharp` (server) | SVG → PNG for OG images and previews |
| Fonts → paths | `opentype.js` | `text-block` must emit paths, never `<text>` |
| Validation | `zod` | DesignSpec + element params |
| Email | Resend | Order confirmations, download links |
| Hosting | Vercel | Set geometry routes to Node runtime, not Edge |
| Testing | Vitest + Playwright | Geometry unit tests are mandatory |

---

## 10. Repo structure

```
livery-lab/
├─ apps/web/                     Next.js app
│  ├─ app/
│  │  ├─ (marketing)/            /, /how-it-works, /faq, /about
│  │  ├─ bodies/
│  │  ├─ design/
│  │  ├─ gallery/
│  │  ├─ orders/[token]/
│  │  ├─ admin/                  password-gated: orders, bodies, stock liveries
│  │  └─ api/
│  │     ├─ compose/route.ts     LLM → DesignSpec
│  │     ├─ render/route.ts      DesignSpec → mockup SVG/PNG
│  │     └─ cutfiles/route.ts    DesignSpec → zip of SVG + DXF + guide
│  └─ components/
├─ packages/
│  ├─ geometry/                  THE ENGINE — build first
│  │  ├─ src/{resolve,transform,boolean,validate,bridge,nest,registration}.ts
│  │  ├─ src/export/{svg,dxf,guide}.ts
│  │  └─ test/                   golden-file tests
│  ├─ elements/                  the 14 generators + registry
│  ├─ bodies/                    BTF loader, schema, validator
│  └─ schema/                    DesignSpec zod schemas, shared types
├─ content/bodies/*.btf.json
├─ config/pricing.ts
└─ scripts/
   ├─ verify-body.ts             CLI: lint a BTF, render panel diagram
   └─ cut-test-sheet.ts          emits a calibration sheet of known widths
```

---

## 11. Environment variables

```bash
DATABASE_URL=
ANTHROPIC_API_KEY=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=livery-lab
RESEND_API_KEY=
ADMIN_PASSWORD=
NEXT_PUBLIC_SITE_URL=
ETSY_LISTING_URL=              # deferred — leave blank, checkout shows "coming soon"
OPENAI_API_KEY=                # deferred — image provider stays Null without it
```

---

## 12. Build order

Ship in this sequence. Each phase is independently demoable.

### Phase 1 — Geometry engine (no UI)
Build `packages/geometry` + `packages/elements` + `packages/bodies`. CLI only: feed it a hand-written DesignSpec JSON, get SVG + DXF out.

**Done when:** you cut the output on your actual Cricut and it weeds cleanly.

- [ ] BTF schema + loader + Camaro `1567-00` file with real panel outlines
- [ ] 6 elements minimum: `slash-tear`, `chevron-arrow`, `stripe-jagged`, `banner-curved`, `text-block`, `ribbon-awareness`
- [ ] Clipper union + offset working, unit tested
- [ ] Min-width detector catches a deliberately 0.8 mm feature
- [ ] Island detector catches a letter "O" counter
- [ ] Auto-bridge produces a connected shape
- [ ] Mirror-X applied to whole sheet
- [ ] Nesting fits within 290×590 mm, spills to sheet 2 correctly
- [ ] SVG passes the Cricut-safe checklist in §3.5
- [ ] DXF opens in a CAD viewer with correct mm scale
- [ ] Golden-file tests so refactors can't silently change geometry

### Phase 2 — Renderer + static site
- [ ] Multi-view mockup renderer (DesignSpec + BTF → composed SVG)
- [ ] Homepage with the animated cut-sheet hero
- [ ] `/bodies`, `/bodies/[id]` from BTF data
- [ ] `/gallery` with 4–6 stock liveries you author by hand as DesignSpec JSON
- [ ] `/how-it-works` with the real paint-order tutorial

### Phase 3 — AI composer
- [ ] `/api/compose` with the Claude prompt, schema validation, repair loop
- [ ] `/design` 4-step flow
- [ ] Editor: select, drag, rotate, delete, mirror, undo/redo
- [ ] Validation issues surfaced in plain language with one-click fixes
- [ ] Save + share via `shareId`

### Phase 4 — Orders
- [ ] Order creation, reference codes, `CheckoutProvider` interface
- [ ] `EtsyLinkProvider` behind a feature flag (dark until you supply the listing URL)
- [ ] `/admin/orders` — mark paid, generate artifacts, email download link
- [ ] `/orders/[token]` status + downloads
- [ ] Resend emails

### Phase 5 — Polish
- [ ] Second verified body (Supra A90)
- [ ] OG image generation per design
- [ ] Rate limiting on `/api/compose` (it costs you money)
- [ ] Analytics, sitemap, structured data on body pages

---

## 13. Copy-paste kickoff prompt for Claude Code

```
Read rc-livery-lab-build-spec.md in full before writing any code.

Build Phase 1 only: the geometry engine. Do not create any Next.js app,
UI, database, or API route yet.

Scaffold a pnpm monorepo with packages/schema, packages/elements,
packages/bodies, packages/geometry. TypeScript strict. Vitest.

Priority order:
1. packages/schema — zod schemas for BodyTemplate (BTF) and DesignSpec v1
   exactly as specified in §2.1 and §2.3.
2. packages/bodies — BTF loader + validator + content/bodies/protoform-1567-00.btf.json
   using the real dimensions in §2.1. Use approximate panel outlines for now
   and mark them with a TODO comment saying they need physical measurement.
3. packages/elements — the ElementDef interface and these six generators:
   slash-tear, chevron-arrow, stripe-jagged, banner-curved, text-block,
   ribbon-awareness. Every generator returns closed subpaths in mm, computes
   a real minFeatureMm from its geometry, and is deterministic given a seed.
   text-block must convert glyphs to paths with opentype.js — never emit <text>.
4. packages/geometry — the 10-stage pipeline in §3.1. Use js-angusj-clipper
   for booleans and offsetting. Implement min-width detection as a
   -0.6mm / +0.6mm morphological opening. Implement island detection via a
   containment tree. Implement auto-bridging per §3.2.
5. Exporters: Cricut-safe SVG per §3.5 (every checklist item is a test),
   DXF via maker.js, and the markdown spray guide from paintOrder.
6. scripts/cut-test-sheet.ts — emits a calibration SVG with bars of
   0.8/1.0/1.2/1.5/2.0mm width so I can verify my cutter's real limit.

Write a fixture DesignSpec for the Camaro and a golden-file test that locks
the output geometry. Then run it and show me the generated SVG.

Ask me before inventing panel outlines you can't derive from the spec sheet.
```

---

## 14. Open decisions — blocked on you

| # | Decision | Blocks | Default if you don't answer |
|---|---|---|---|
| 1 | Etsy listing structure and pricing | Phase 4 | Checkout stays dark, "Join waitlist" instead |
| 2 | Digital files only, physically cut sheets, or both? | Pricing, shipping copy, order model | Both, with digital cheaper |
| 3 | Real measured panel outlines for the Camaro | Cut accuracy — approximations will misfit | Approximations with visible "beta" badge |
| 4 | Mask material you actually stock | Product copy, pricing | Oramask 810 primary |
| 5 | Do customers get the DesignSpec / reuse rights? | Terms page | Personal use, no resale |
| 6 | Image gen provider once you set up API billing | Nothing — Null provider is fine | Stays off |

---

## 15. Things that will bite you

- **Curvature.** A 120 mm slash placed flat will not lie flat on a fender. Tag high-curvature panels and cap element size there; the BTF `curvature` field exists for exactly this. Long straight elements crossing a compound curve need to be split into segments.
- **Paint order is counterintuitive.** Inside-Lexan means first-sprayed = most visible. Get this wrong in the guide and every customer ruins a body. Write tests for the guide generator.
- **Text kerning at small sizes.** Below ~12 mm cap height, letter counters violate the 1.2 mm rule. Enforce a minimum in `text-block` and tell the user why rather than silently cutting garbage.
- **`svgo` strips what Cricut needs.** Always run the custom post-pass after it, and test the final file, not the pre-optimisation one.
- **`/api/compose` costs real money per call.** Rate limit it and cache identical briefs before you make the site public.
- **Vercel Edge runtime can't run the Clipper WASM reliably.** Force `export const runtime = 'nodejs'` on every geometry route.

---

*End of specification.*
