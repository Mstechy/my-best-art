# Design Token Reconciliation — sketch tokens ↔ this repo

Every token the sketches reference, where it came from, and whether it exists here.
**Headline: the sketches use a semantic token layer (`--ink`, `--brand`, `--line`…) that does not exist in this repo at all.** This repo styles with hard-coded hex (`#111111`, `#F6C75D`) and shadcn HSL vars (`--primary`, `--accent`).

## 1. Tokens the sketches reference (none defined in this repo)

| Token | Used in | Purpose |
| --- | --- | --- |
| `--ink` | cart, checkout | primary text |
| `--ink-soft` | cart (`.summary-row`) | softer text |
| `--muted` | category, cart, checkout | muted text |
| `--line` | category, cart, checkout | default border |
| `--line-strong` | category, cart, checkout | stronger border |
| `--panel` | category (`.filter-toggle`) | surface background |
| `--brand` | cart, checkout | brand / primary action |
| `--brand-dark` | category, cart, checkout | links + active step |
| `--deal` | cart (coupon amount) | discount / deal colour |
| `--radius-m` | cart, checkout | medium corner radius |
| `--font-sans` | `redesign_style_guide.html` | body font |
| `--text-secondary` | `redesign_style_guide.html` | secondary text |
| `--surface-2` | `redesign_style_guide.html` | alternate surface |
| `--border` | `redesign_style_guide.html` | border |

## 2. Hex values known from `redesign_style_guide.html`

| Hex | Name | Confident token |
| --- | --- | --- |
| `#FAFAFA` | Page white | likely `--page` / `--background` |
| `#F2F3F5` | Cool neutral | likely `--surface-2` / `--panel` |
| `#F8F3F0` | Warm cream | possibly `--panel` |
| `#F6C75D` | Sale accent | badge bg / likely `--brand` or `--deal` |
| `#111111` | Primary text / ink | **`--ink`** ✅ (name matches exactly) |
| `#888880` | Secondary text | **`--muted`** / `--text-secondary` ✅ |
| `#FFFFFF` | Card surface | `--panel` |
| `#5C3A00` | Badge text on `#F6C75D` | (no token seen) |
| `#a8a696` | footer copy (inline style in sketch) | muted-on-dark |

## 3. Repo hexes already in use (pre-tokenisation)

`LandingPage.tsx`, `MarketplaceNavbar.tsx`, `SiteFooter.tsx`, `BottomTabBar.tsx`, `CheckoutPage.tsx` all hard-code:
`#FAFAFA` bg · `#F8F3F0` · `#F2F3F5` · `#FFFFFF` · `#111111` ink · `#888880` secondary · `#F6C75D` accent · `#E8E8E8` border · `#D8D8D2` dashed border · `#E53935` discount · `#FAF5F2` dark-theme text · `#1A1A1A`/`#222222` dark surfaces.

**These map 1:1 onto the sketch's tokens** — `#E8E8E8` → `--line`, `#D8D8D2` → `--line-strong`, `#111111` → `--ink`, `#888880` → `--muted`, `#E53935` → likely `--deal`.

## 3b. ✅ RESOLVED — `style.css` received. The brand colour is ORANGE.

`style.css` arrived and settles every open question. **The single most important finding: the brand colour is `#ff7a1a` (orange) — NOT `#F6C75D` (the yellow currently hard-coded throughout this repo).**

```css
--brand:#ff7a1a;  --brand-dark:#e0630a;  --brand-tint:#fff1e6;
```

### 🚨 `redesign_style_guide.html` in the repo root is a DIFFERENT concept

That file's own `<h2 class="sr-only">` says: *"Color and typography style guide extracted from the **Amazon** redesign concept"*. Its values (`#FAFAFA`, `#111111`, `#888880`, `#F6C75D`, `#F2F3F5`, `#F8F3F0`, `#5C3A00`) **do not appear anywhere in `style.css`** — and `style.css` uses tokens (`--text-secondary`, `--surface-2`) that the Amazon guide uses but `style.css` doesn't define. **Two separate design concepts. `style.css` is the one that matches the sketches.** Treat the Amazon guide as superseded.


## 5. The existing (broken) token attempt

`tailwind.config.ts` (UNCOMMITTED) declares:
```ts
success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--success-foreground))" },
info:    { DEFAULT: "hsl(var(--info))",    foreground: "hsl(var(--info-foreground))" },
price:   "hsl(var(--price))",
ink:     { DEFAULT: "hsl(var(--ink))",     foreground: "hsl(var(--ink-foreground))" },
```
and `src/index.css` (UNCOMMITTED) declares `.gradient-deal { background: var(--gradient-deal) }`.

**Not one of `--success`, `--info`, `--price`, `--ink`, `--ink-foreground`, `--gradient-deal` is defined anywhere.** So `bg-ink`, `bg-success`, `bg-info`, `text-price` and `.gradient-deal` all currently render as **nothing**. This looks like a previous attempt to wire exactly the sketch's tokens that was abandoned halfway.

Note the mismatch: this config expects `--ink` as **HSL components** (`hsl(var(--ink))`), but the sketches use `--ink` as a **hex** directly (`color:var(--ink)`). Those two idioms are incompatible — the token layer must pick one. Since `style.css` defines `--ink:#14140f`, `hsl(#14140f)` is **invalid CSS** — that's a hard bug, and it confirms the HSL approach must be abandoned in favour of raw values.

---

## 6. Full reconciliation — sketch tokens vs. this repo

| Token | `style.css` value | Repo today | Match |
| --- | --- | --- | --- |
| `--ink` | `#14140f` | `#111111` hard-coded ~200× | ❌ close, not equal |
| `--ink-soft` | `#33322b` | — | ❌ new |
| `--paper` | `#fafaf9` | `#FAFAFA` | ❌ off by one |
| `--panel` | `#ffffff` | `#FFFFFF` ✅ | ✅ |
| `--line` | `#e7e4dc` | `#E8E8E8` | ❌ cool → **warm** |
| `--line-strong` | `#d8d4c8` | `#D8D8D2` | ❌ cool → **warm** |
| `--muted` | `#6e6c64` | `#888880` | ❌ **noticeably darker** |
| **`--brand`** | **`#ff7a1a` ORANGE** | **`#F6C75D` YELLOW** | ❌❌ **MAJOR** |
| `--brand-dark` | `#e0630a` | — | ❌ new |
| `--brand-tint` | `#fff1e6` | — | ❌ new |
| `--deal` | `#e0281b` | `#E53935` | ❌ close |
| `--deal-tint` | `#fdecea` | — | ❌ new |
| `--ok` | `#1a7a4c` | `success` (undefined!) | ❌ new |
| `--ok-tint` | `#e9f7ef` | — | ❌ new |
| `--star` | `#f5a623` | — | ❌ new |
| `--radius-s` | `6px` | `--radius: 0.5rem` (8px) | ❌ |
| `--radius-m` | `10px` | — | ❌ new |
| `--shadow-card` | `0 1px 2px rgba(20,20,15,.04)` | `shadow-card` `hsl(0 0% 0% / .05)` | ~ similar |
| `--shadow-pop` | `0 12px 32px rgba(20,20,15,.14)` | — | ❌ new |
| `--header-h` | `60px` | — | ❌ new |
| `--catbar-h` | `44px` | — | ❌ new |

**Net: of 22 tokens, 1 matches. The palette is a warm/near-black + orange system; the repo is a cool grey + yellow system.**

## 7. Font conflict — now RESOLVED

`style.css` body: `font-family:"Inter","Segoe UI",system-ui,-apple-system,sans-serif`
→ **Inter wins.** Therefore:
- ✅ `src/index.css` `--font-body: 'Inter'` is **correct**
- ❌ `tailwind.config.ts` `body: ["'DM Sans'", ...]` is **wrong** and must change
- ⚠️ `display: ["'Space Grotesk'"]` — `style.css` sets headings to `font-weight:800` on **Inter**, no display font. Space Grotesk is unaccounted for; likely should be dropped (or deliberately kept for `h1–h6` only if you want it).
- ⚠️ Sketch pages use `font-sans` via Tailwind, which is **uncustomised** → currently falls back to the browser stack, so the homepage isn't even using DM Sans *or* Inter today.

## 8. Breakpoint conflict

`style.css` uses `@media (max-width:1080px)` and `@media (max-width:760px)`.
Tailwind defaults: `sm:640 md:768 lg:1024 xl:1280`.
- `760px` ≈ `md` (768) — 8px off, usable but not exact
- `1080px` sits **between** `lg` (1024) and `xl` (1280) — **no Tailwind equivalent**

This needs a decision: add an `xlg:1080px` screen, or snap to `lg`/`xl`.

## 9. Impact on the shadcn token layer (`src/index.css`)

| shadcn var | Current | Conflicts with sketch because |
| --- | --- | --- |
| `--primary` | `252 62% 55%` **purple** | should be brand orange `#ff7a1a` |
| `--accent` | `173 58% 39%` **teal** | collides with `--brand-tint` / `--ok-tint` usage |
| `--border` | `220 13% 91%` cool grey | sketch wants warm `--line:#e7e4dc` |
| `--radius` | `0.5rem` (8px) | sketch wants `6px` (`-s`) / `10px` (`-m`) |
| `--navbar` | `222 47% 11%` | sketch rail is `var(--ink)` `#14140f` |
| `--success` | **not defined** | `--ok:#1a7a4c` slots straight in |

---

## 10. ✅ DECISION CONFIRMED — raw values, `var()` in `colors`, no `hsl()` wrapper

Owner's decision:
```ts
colors: { ink: 'var(--ink)' }   // no hsl() wrapper
```
**This is the correct fix** and it settles the hard bug in §5. The reason it works:

- `--ink: #14140f` is a **complete colour value**, so `var(--ink)` substitutes straight in. ✅
- `hsl(var(--ink))` would expand to `hsl(#14140f)` — **invalid CSS**, which is why the previous attempt silently rendered nothing. ❌

### One critical consequence to respect

Raw-value tokens **cannot** support opacity modifiers the way HSL-triplet tokens do.

```html
<div class="bg-ink/50">   <!-- ❌ produces NOTHING with var() raw values -->
<div class="bg-ink">      <!-- ✅ fine -->
```

Tailwind cannot inject an alpha channel into an opaque `var()`. The sketch itself hits this — `style.css` uses hard-coded `rgba(20,20,15,.04)` for `--shadow-card` and `#c9c7bd` / `#d8d6cc` / `#8a8878` for translucent-on-dark text, precisely because alpha maths isn't available.

**So the rule becomes:**
- **Raw `var()` tokens** for solid colours (`ink`, `brand`, `deal`, `ok`, `star`, `line`, `paper`) ✅
- **Keep `hsl(var(--x) / <alpha>)` triplets** for the **shadcn semantic set only** (`--primary`, `--muted`, `--border`, `--ring`…) if you still need `bg-primary/10` style opacity there — those vars are already defined as HSL triplets in `src/index.css` and work today.
- **Never mix the two for the same token.** `--ink` is raw; do not also declare `--ink: 60 6% 7%` anywhere.

### Also note: `var()` breaks nothing at build time
Tailwind passes `var(--ink)` through as an opaque string, so the class is generated and simply resolves at runtime. One upside: **theming becomes trivial** — redefine `--ink` inside `.dark {}` and every `bg-ink`/`text-ink` updates with no rebuild. That's a strong argument for this approach and it's how you'd solve the unaddressed dark-mode gap (§ ERROR 12 in the alignment review).


