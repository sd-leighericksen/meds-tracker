# Nimbus Design System

> The single source of truth for the **Nimbus** visual language. Drop this file into the root of any project (as `DESIGN.md`) and defer all front-end styling decisions to it. Token names are the contract: reference `{colors.primary}`, `{rounded.full}`, `text-h3` and so on in code (wired into the Tailwind theme, see the Implementation appendix at the foot of this file) rather than hard-coding raw values.
>
> Every value below is reconciled against the reference implementation (the Routine Grid app) so a new build reproduces the same look exactly. Token identifiers use the `colors.*` / `rounded.*` namespace (code identifiers, kept stable for tooling). All prose is Australian English.
>
> **Surface applicability:** the marketing surfaces (hero band, promo banner, pricing table, large footer) are optional and project-dependent. An app build (a touch grid, a dashboard, an internal tool) uses the buttons, cards, inputs, tabs, badges, type scale, radii and elevation, and usually skips the marketing furniture. Take what the project needs; the tokens and core components are the constant.

## Overview

Nimbus is a confident, slightly playful product-and-marketing language built on a stark white canvas, a single signature accent (canary yellow), black pill CTAs, and a family of pastel cards that carry warmth without shouting. The aesthetic leans on generous whitespace, a geometric sans, and flat surfaces with depth reserved for moments that matter.

**Key characteristics:**
- Stark white canvas with the brand wordmark in canary yellow (`{colors.brand-yellow}`) as the recognisable opening signature.
- Black pill CTAs (`{colors.primary}` + `{rounded.full}`) as the dominant interactive element across every surface.
- Pastel cards (yellow, rose, coral, teal, orange) used in deliberate counterpoint to white cards in the same viewport.
- A single sans across every UI surface, from oversized display down to micro labels.
- Real product UI mockups as feature illustrations, never stock photography.
- A pill-everything rule: buttons, tabs, filter chips and status badges all use `{rounded.full}`.
- The accent yellow is rationed hard. It is a signature, not a workhorse.

## Colours

> All values resolved and matched to the reference app. Pastel card tints are deliberately lighter than their saturated counterparts so they sit quietly behind text.

### Brand & accent

| Token | Value | Use |
|---|---|---|
| `{colors.brand-yellow}` | `#FFD02F` | Signature canary yellow. Wordmark, promo banner, yellow tag chips, completed-cell tint |
| `{colors.brand-yellow-deep}` | `#E6B800` | Darker variant for emphasis and pressed states |
| `{colors.yellow-light}` | `#FFF6CC` | Pale yellow background tint for tag chips and avatars |
| `{colors.yellow-dark}` | `#5C4A00` | Dark olive foreground for yellow chip text |
| `{colors.brand-blue}` | `#4262FF` | Action blue for inline links, focus borders, the featured pricing border |
| `{colors.blue-pressed}` | `#2D45C9` | Pressed-state blue |
| `{colors.brand-coral}` | `#F16C5F` | Coral accent for warm callouts |
| `{colors.coral-light}` | `#FCDED9` | Pale coral for feature card backgrounds |
| `{colors.coral-dark}` | `#8A2E26` | Deep wine foreground for coral chip text |
| `{colors.brand-rose}` | `#FFCDE4` | Soft rose-pink for feature card variants |
| `{colors.rose-light}` | `#FFE4F0` | Pale rose for feature card backgrounds |
| `{colors.brand-teal}` | `#5BC4BE` | Brand teal |
| `{colors.teal-light}` | `#D4F3F0` | Pale teal for feature card backgrounds and complete states |
| `{colors.moss-dark}` | `#1F4B47` | Deep teal-green foreground text |
| `{colors.brand-pink}` | `#FFD4E5` | Pale pink for soft callouts |
| `{colors.brand-orange-light}` | `#FFE5D0` | Soft orange for feature card backgrounds |

### Surface

| Token | Value | Use |
|---|---|---|
| `{colors.canvas}` | `#FFFFFF` | Page background and primary card surface |
| `{colors.surface}` | `#F5F5F7` | Rest/pressed states (`active:bg-surface`), search-pill rest |
| `{colors.surface-soft}` | `#FAFAFC` | Quieter section backgrounds, sidebars, empty cells (lighter than `surface`) |
| `{colors.surface-yellow}` | `#FFF8D6` | Pale yellow-tinted surface for tag chips |
| `{colors.surface-pricing-featured}` | `#ECE6FE` | Pale lavender for the featured pricing tier and selected states |
| `{colors.hairline}` | `#E4E4EB` | 1px borders and primary dividers |
| `{colors.hairline-soft}` | `#EDEDF0` | Quieter row and section dividers |
| `{colors.hairline-strong}` | `#C5C5D6` | Stronger 1px border for inputs and secondary buttons |

### Text & ink

| Token | Value | Use |
|---|---|---|
| `{colors.primary}` | `#050038` | The brand near-black (Stratos). Dominant CTA fill, dark surfaces |
| `{colors.on-primary}` | `#FFFFFF` | Text and icons on `{colors.primary}` |
| `{colors.ink-deep}` | `#050038` | Headlines on pastel cards (semantic alias of `ink`) |
| `{colors.ink}` | `#050038` | Primary headlines and body text |
| `{colors.charcoal}` | `#2B2A4C` | Body emphasis text, pressed primary button |
| `{colors.slate}` | `#4D4D7A` | Secondary text, metadata |
| `{colors.steel}` | `#777789` | Tertiary text, table headers, footer links |
| `{colors.stone}` | `#9D9DAD` | Captions, muted labels, placeholder glyphs |
| `{colors.muted}` | `#C5C5D6` | Disabled labels, input placeholders |
| `{colors.on-dark}` | `#FFFFFF` | White text on dark surfaces |
| `{colors.on-dark-muted}` | `rgba(255,255,255,0.7)` | Reduced-opacity white on dark |
| `{colors.footer-bg}` | `#0F0D2E` | Large footer background (a touch warmer than `primary`) |

### Semantic

| Token | Value | Use |
|---|---|---|
| `{colors.success-accent}` | `#3AC267` | Confirmation / success indicator green |
| `{colors.brand-red}` | `#FFD1CF` | Soft red for error backgrounds (often at reduced opacity) |
| `{colors.brand-red-dark}` | `#D43F3F` | Stronger red for error borders, text and the destructive button |

## Typography

### Font family

The reference app ships **Inter**. Token: `font-sans`.

- **Current stack (as shipped):** `"Inter", "Noto Sans", -apple-system, BlinkMacSystemFont, sans-serif`

Note on character: the Nimbus look is defined in part by a slightly rounded, geometric face. Inter is a neutral grotesque and does not carry that rounded character. If that character matters for a given project, swap the first family for a rounded-geometric face (for example General Sans, free for commercial use, or a licensed Roobert PRO) and change it in one place (the `fontFamily.sans` token). Keep the choice consistent across the app and any new build.

### Hierarchy

| Token | Size | Weight | Line height | Letter spacing | Use |
|---|---|---|---|---|---|
| `{typography.hero-display}` | 80px | 500 | 1.05 | -2px | Marketing hero headline |
| `{typography.display-lg}` | 60px | 500 | 1.10 | -1.5px | Major section openers |
| `{typography.h1}` | 48px | 500 | 1.15 | -1px | Page-level headlines |
| `{typography.h2}` | 36px | 500 | 1.20 | -0.5px | Subsection headlines |
| `{typography.h3}` | 28px | 500 | 1.25 | 0 | Card titles, panel headers |
| `{typography.h4}` | 22px | 500 | 1.30 | 0 | Feature tile titles, dialog titles |
| `{typography.h5}` | 18px | 500 | 1.40 | 0 | Smaller cards, list item titles |
| `{typography.subtitle}` | 18px | 400 | 1.50 | 0 | Hero and section subtitles |
| `{typography.body-md}` | 16px | 400 | 1.50 | 0 | Primary body text |
| `{typography.body-sm}` | 14px | 400 | 1.50 | 0 | Secondary body, table cells, labels |
| `{typography.caption}` | 13px | 400 | 1.40 | 0 | Helper text |
| `{typography.caption-bold}` | 13px | 600 | 1.40 | 0 | Badge labels, tag chips, status chips |
| `{typography.micro}` | 12px | 500 | 1.40 | 0 | Footer microcopy |
| `{typography.micro-uppercase}` | 11px | 600 | 1.40 | 0.5px | Section dividers, stat labels |
| `{typography.button-md}` | 14px | 500 | 1.30 | 0 | Pill button and tab labels |
| `{typography.stat-display}` | 64px | 500 | 1.10 | -1.5px | Marketing and clock stat callouts |

Medium-weight emphasis (for example a 16px or 14px label at weight 500) is not a separate size token. Apply the `font-medium` utility to the matching `body-md` / `body-sm` token, as the reference app does.

### Principles

- **Tight display leading** (1.05) gives the 80px hero a magazine-grade feel. Do not loosen it below 1.05.
- **Negative letter-spacing progression:** display sizes run -2px to -1.5px; smaller headings relax to 0.
- **Single weight scale:** 400 (body), 500 (medium emphasis and headings), 600 (badges and uppercase). The system does not use 700.
- Default to `{typography.body-md}` for body and `{typography.subtitle}` for emphasis.

## Layout

### Spacing

- **Base unit:** 4px, with 8px as the primary increment.
- The reference app uses Tailwind's default numeric spacing scale (`p-4`, `gap-6`, `px-8` and so on), which is also 4px-based. New builds should do the same. The semantic names below are an optional mapping for documentation and for marketing surfaces that want a coarser rhythm; they coincide with the default scale, so do not mix arbitrary off-scale values.
- **Optional semantic tokens:** `xxs` 4px · `xs` 8px · `sm` 12px · `md` 16px · `lg` 20px · `xl` 24px · `xxl` 32px · `xxxl` 40px · `section-sm` 48px · `section` 64px · `section-lg` 96px · `hero` 120px
- **Section rhythm:** marketing surfaces breathe at 96px; dense surfaces (pricing, comparison) tighten to 64px.
- **Card internal padding:** 24px for compact cards; 32px for feature panels.

### Grid & container

- Marketing pages use a 1280px max-width with 32px gutters.
- App surfaces set their own container to the device, not the 1280px marketing width. For a fixed-device build, lock the layout to the device dimensions and treat the spacing scale as the constant.

### Whitespace philosophy

Marketing surfaces give content generous breathing room; a small wordmark earns its presence through the space around it. Dense and app surfaces tighten deliberately. The scale is the same; the rhythm changes with the surface.

## Elevation & depth

The system runs predominantly flat, with depth reserved for product mockups and overlays. Shadows are tinted with the brand near-black (`rgb(5, 0, 56)` = `{colors.primary}`), never neutral grey.

| Token | Treatment | Use |
|---|---|---|
| level 0 (flat) | No shadow; `{colors.hairline-soft}` border | Default cards, table rows, form inputs |
| `shadow-elev-1` | `rgba(5, 0, 56, 0.04) 0px 1px 2px 0px` | List cards, subtly raised tiles |
| `shadow-elev-2` | `rgba(5, 0, 56, 0.06) 0px 4px 12px 0px` | Standard feature cards |
| `shadow-elev-3` | `rgba(5, 0, 56, 0.08) 0px 12px 32px -4px` | Product mockup framing, toasts |
| `shadow-elev-4` | `rgba(5, 0, 56, 0.12) 0px 16px 48px -8px` | Modals, sheets, dropdowns |

Pastel cards carry their own visual weight through saturated background colour rather than shadow. Do not stack heavy shadows on flat documentation cards.

## Shapes

### Border radius scale

| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 4px | Small chips, micro-controls |
| `{rounded.sm}` | 6px | Discount badges |
| `{rounded.md}` | 8px | Inputs, search pill |
| `{rounded.lg}` | 12px | Standard cards, table containers |
| `{rounded.xl}` | 16px | Pricing cards, feature panels, product mockups, assignment cells |
| `{rounded.2xl}` | 20px | Larger feature cards, grid cells, status banners |
| `{rounded.3xl}` | 28px | Pastel feature cards, empty-state panels |
| `{rounded.feature}` | 32px | Hero CTA banners, celebration and toast surfaces |
| `{rounded.full}` | 9999px | All buttons, pill tabs, badges, avatars (Tailwind default) |

The pill is the brand signature. Every button, pill tab and status badge uses `{rounded.full}`. Do not soften it.

## Components

> Default and pressed/active states only. Hover is a minor lift, not a colour change. Recommended transition: 150 to 200ms ease. The reference app implements the button variants marked (shipped); the rest are documented Nimbus patterns.

### Buttons

**`button-primary`** (shipped) — Black pill primary CTA, the dominant action.
- Background `{colors.primary}`, text `{colors.on-primary}`, typography `{typography.button-md}`, padding `12px 24px`, rounded `{rounded.full}`.
- Pressed lifts to `{colors.charcoal}`. Disabled drops opacity (50%).
- Sizes: `sm` 40px / `md` 48px / `lg` 56px height.

**`button-secondary`** (shipped) — Outlined pill for secondary actions.
- Background `{colors.canvas}`, text `{colors.ink}`, border `1px solid {colors.hairline-strong}`, pressed `active:bg-surface`, rounded `{rounded.full}`.

**`button-yellow`** (shipped) — Brand-yellow pill for moments of brand emphasis.
- Background `{colors.brand-yellow}`, text `{colors.primary}`, pressed `{colors.brand-yellow-deep}`, rounded `{rounded.full}`.

**`button-danger`** (shipped) — Destructive action pill.
- Background `{colors.brand-red-dark}`, text `{colors.on-primary}`, pressed drops opacity, rounded `{rounded.full}`.

**`button-ghost`** (shipped) — Quieter transparent button.
- Background transparent, text `{colors.ink}`, pressed `active:bg-surface`, rounded `{rounded.full}` (or `{rounded.md}` for rectangular ghost).

**`button-blue`** — Brand-blue pill for inline action callouts.
- Background `{colors.brand-blue}`, text `{colors.on-primary}`, rounded `{rounded.full}`.

**`button-on-dark`** — White pill for dark CTA banners.
- Background `{colors.on-dark}`, text `{colors.primary}`, rounded `{rounded.full}`.

**`button-link`** — Inline text link.
- Background transparent, text `{colors.brand-blue}`, typography `{typography.body-sm}` at `font-medium`.

**`button-icon-circular`** — Circular utility button, 36x36px (44x44px on touch).
- Background `{colors.canvas}`, text `{colors.ink}`, border `1px solid {colors.hairline}`, rounded `{rounded.full}`.

### Cards & containers

**`card-base`** — Standard content card.
- Background `{colors.canvas}`, rounded `{rounded.xl}`, padding 24px, border `1px solid {colors.hairline-soft}`. List cards add `shadow-elev-1`.

**`card-feature`** — White feature card with larger corners.
- Background `{colors.canvas}`, rounded `{rounded.3xl}`, padding 32px, border `1px solid {colors.hairline-soft}`.

**`card-feature-yellow`** — Background `{colors.brand-yellow}`, text `{colors.primary}`, rounded `{rounded.3xl}`, padding 32px.

**`card-feature-coral`** — Background `{colors.coral-light}`, text `{colors.primary}`, rounded `{rounded.3xl}`, padding 32px.

**`card-feature-teal`** — Background `{colors.teal-light}`, text `{colors.primary}`, rounded `{rounded.3xl}`, padding 32px.

**`card-feature-rose`** — Background `{colors.rose-light}`, text `{colors.primary}`, rounded `{rounded.3xl}`, padding 32px.

**`card-feature-orange`** — Background `{colors.brand-orange-light}`, text `{colors.primary}`, rounded `{rounded.3xl}`, padding 32px.

**`card-media`** — Media or story card with full-bleed imagery.
- Background `{colors.canvas}`, rounded `{rounded.3xl}`, padding 0 (image fills the card), border `1px solid {colors.hairline-soft}`.

**`card-stat`** — Stat-row cell for large numeric callouts.
- Background transparent, text `{colors.ink}`, typography `{typography.stat-display}`.

**`pricing-card`** — Background `{colors.canvas}`, rounded `{rounded.xl}`, padding 32px, border `1px solid {colors.hairline}`.

**`pricing-card-featured`** — Background `{colors.surface-pricing-featured}`, rounded `{rounded.xl}`, padding 32px, border `2px solid {colors.brand-blue}`.

**`pricing-card-dark`** — Background `{colors.primary}`, text `{colors.on-primary}`, rounded `{rounded.xl}`, padding 32px.

### Inputs & forms

**`text-input`** — Standard text field.
- Background `{colors.canvas}`, text `{colors.ink}`, border `1px solid {colors.hairline-strong}`, rounded `{rounded.md}`, padding `12px 16px`, height 44-56px.

**`text-input-focused`** — Border switches to `{colors.brand-blue}` (`focus:border-brand-blue`, no outline).

**`text-input-error`** — Border `{colors.brand-red-dark}`; helper text in `{colors.brand-red-dark}`.

**`search-pill`** — Background `{colors.surface}`, text `{colors.steel}`, typography `{typography.body-sm}`, rounded `{rounded.md}`, height 40px, border `1px solid {colors.hairline}`.

**`filter-dropdown`** — Background `{colors.canvas}`, text `{colors.ink}`, typography `{typography.body-sm}` at `font-medium`, rounded `{rounded.full}`, border `1px solid {colors.hairline-strong}`.

**`select`** — Native select styled as a pill: rounded `{rounded.full}`, border `1px solid {colors.hairline-strong}`, height 48px, padding `0 16px`.

### Tabs

**`pill-tab`** + **`pill-tab-active`** — Pill-style tab nav.
- Inactive: background `{colors.canvas}`, text `{colors.ink}` or `{colors.steel}`, border `1px solid {colors.hairline-strong}`, rounded `{rounded.full}`, pressed `active:bg-surface`.
- Active: background `{colors.primary}`, text `{colors.on-primary}`.

**`toggle-binary`** — Two-state pill toggle.
- Track background `{colors.surface}`, rounded `{rounded.full}`, padding 4px. Active segment: `{colors.primary}` on `{colors.on-primary}`.

### Badges & status

**`badge-promo`** — Background `{colors.brand-yellow}`, text `{colors.primary}`, typography `{typography.caption-bold}`, rounded `{rounded.full}`, padding `4px 10px`.

**`badge-tag-yellow`** — Background `{colors.surface-yellow}`, text `{colors.yellow-dark}`, typography `{typography.caption-bold}`, rounded `{rounded.full}`.

**`badge-tag-lavender`** — Background `{colors.surface-pricing-featured}`, text `{colors.brand-blue}`, typography `{typography.caption-bold}`, rounded `{rounded.full}`.

**`badge-tag-coral`** — Background `{colors.coral-light}`, text `{colors.coral-dark}`, typography `{typography.caption-bold}`, rounded `{rounded.full}`.

**`chip-complete`** — Background `{colors.teal-light}`, text `{colors.moss-dark}`, typography `{typography.caption-bold}`, rounded `{rounded.full}`. (Reference app: locked-complete / outcome chip.)

**`chip-locked`** — Background `{colors.surface}`, text `{colors.stone}`, typography `{typography.caption-bold}`, rounded `{rounded.full}`. (Reference app: locked-missed / locked chip.)

**`badge-success`** — Background `{colors.success-accent}`, text `{colors.on-primary}`, typography `{typography.caption-bold}`, rounded `{rounded.full}`.

**`badge-discount`** — Background `{colors.brand-yellow}`, text `{colors.primary}`, typography `{typography.caption-bold}`, rounded `{rounded.sm}`, padding `2px 6px`.

### Overlays

**`sheet`** / **`dialog`** — Centred modal surface.
- Scrim `{colors.ink}` at ~40% opacity. Panel: background `{colors.canvas}`, rounded `{rounded.3xl}`, `shadow-elev-4`, header/footer divided by `1px solid {colors.hairline-soft}`.

**`toast`** — Background `{colors.primary}` (info) / `{colors.success-accent}` (success) / `{colors.brand-red-dark}` (error), text `{colors.on-primary}`, rounded `{rounded.feature}`, `shadow-elev-3`.

**`celebration-surface`** — Centred card on a `{colors.ink}`/30 scrim: background `{colors.canvas}`, rounded `{rounded.feature}`, `shadow-elev-4`.

### Documentation & media components

**`product-mockup`** — Real product UI as a feature illustration.
- Background `{colors.canvas}`, rounded `{rounded.xl}`, border `1px solid {colors.hairline-soft}`, `shadow-elev-3`. Always a real product screen, never stock photography.

**`thumb-card`** — Background `{colors.canvas}`, rounded `{rounded.xl}`, padding 16px, border `1px solid {colors.hairline}`.

**`feature-tile`** — Background `{colors.canvas}`, rounded `{rounded.xl}`, padding 24px, border `1px solid {colors.hairline-soft}`.

**`faq-accordion-item`** — Background `{colors.canvas}`, rounded `{rounded.md}`, padding 24px, bottom border `1px solid {colors.hairline}`.

**`logo-wall-item`** — Background transparent, text `{colors.steel}`, typography `{typography.body-md}` at `font-medium`, padding 20px.

**`empty-state`** — Centred panel: background `{colors.canvas}`, rounded `{rounded.3xl}`, padding 48px, border `1px solid {colors.hairline-soft}`, `shadow-elev-1`. Large emoji or icon, `{typography.h5}` title, `{typography.body-sm}` body in `{colors.slate}`, a primary CTA.

### Navigation & signature surfaces (marketing, optional)

**`promo-banner`** — Sticky black strip above the top nav. Background `{colors.primary}`, text `{colors.on-primary}`, typography `{typography.body-sm}` at `font-medium`. Carries an inline yellow pill.

**`top-nav`** — Sticky white bar, ~64px. Background `{colors.canvas}`. Left: yellow wordmark plus links. Right: secondary links plus a black-pill `button-primary`.

**`hero-band`** — Background `{colors.canvas}`, padding 120px. Centred headline in `{typography.hero-display}`, centred subtitle, centred button row, product mockup below.

**`cta-banner-dark`** — Background `{colors.primary}`, text `{colors.on-primary}`, rounded `{rounded.feature}`, padding 64px. Centred headline, subtitle, and a `button-on-dark`.

**`footer-region`** — Large multi-column dark footer. Background `{colors.footer-bg}`, padding `64px 32px`. Section headings in `{typography.body-md}` at `font-medium`, `{colors.on-dark}`.

**`footer-link`** — Background transparent, text `{colors.on-dark-muted}`, typography `{typography.body-sm}`.

## Do's and don'ts

### Do
- Reserve `{colors.brand-yellow}` for the wordmark, promo banner, yellow tag chips, and the completed-state tint.
- Use `{colors.primary}` (near-black) as the dominant CTA on all surfaces.
- Pair pastel feature cards with white feature cards in the same viewport.
- Apply `{rounded.full}` to every button, pill tab and status badge.
- Apply `{rounded.3xl}` (28px) to pastel feature cards and empty-state panels.
- Use real product UI mockups as feature illustrations.
- Hold a single type face across every UI surface.
- Tint shadows with `rgb(5, 0, 56)`, never neutral grey.

### Don't
- Don't use `{colors.brand-yellow}` on standard CTAs or large background surfaces.
- Don't introduce accent colours beyond the documented yellow, blue and brand pastels.
- Don't soften the pill on buttons; it is a signature.
- Don't reduce display leading below 1.05.
- Don't apply heavy shadows to flat documentation cards; reserve elevation for mockups and overlays.
- Don't use stock photography; show the live product UI.
- Don't reach for weight 700; the scale stops at 600.

## Responsive behaviour

### Breakpoints (marketing)

| Name | Width | Key changes |
|---|---|---|
| Mobile (small) | < 480px | Single column. Hero to 36px. Nav to hamburger. Tiers stack 1-up. |
| Mobile (large) | 480 – 767px | Feature tiles 2-up. Hero to 48px. |
| Tablet | 768 – 1023px | 2-column feature grids. Pill-tab nav returns. |
| Desktop | 1024 – 1279px | 4-tier pricing row. Story grid 2-up. Hero at 64px. |
| Wide desktop | >= 1280px | Full hero presentation, 80px display. |

For fixed-device app builds, ignore the marketing breakpoints and lock the layout to the device (the reference app locks to landscape and shows a rotate prompt in portrait). The scale still applies.

### Touch targets
- Pill buttons render at 40 to 56px height (`sm`/`md`/`lg`).
- Circular icon buttons: 36x36px on pointer devices, 44x44px on touch.
- Form inputs render at 44 to 56px height.
- Set `touch-action: manipulation` on tappable controls to kill the 300ms delay and double-tap zoom.

## Implementation — Tailwind

This mirrors the reference app's `tailwind.config.ts`. Drop it in and code references token names, not raw hex. Spacing is intentionally not extended; use Tailwind's default 4px scale. `rounded-full` is a Tailwind default and needs no entry.

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-yellow': '#FFD02F',
        'brand-yellow-deep': '#E6B800',
        'yellow-light': '#FFF6CC',
        'yellow-dark': '#5C4A00',
        'brand-blue': '#4262FF',
        'blue-pressed': '#2D45C9',
        'brand-coral': '#F16C5F',
        'coral-light': '#FCDED9',
        'coral-dark': '#8A2E26',
        'brand-rose': '#FFCDE4',
        'rose-light': '#FFE4F0',
        'brand-teal': '#5BC4BE',
        'teal-light': '#D4F3F0',
        'moss-dark': '#1F4B47',
        'brand-pink': '#FFD4E5',
        'brand-orange-light': '#FFE5D0',
        canvas: '#FFFFFF',
        surface: '#F5F5F7',
        'surface-soft': '#FAFAFC',
        'surface-yellow': '#FFF8D6',
        'surface-pricing-featured': '#ECE6FE',
        hairline: '#E4E4EB',
        'hairline-soft': '#EDEDF0',
        'hairline-strong': '#C5C5D6',
        'ink-deep': '#050038',
        ink: '#050038',
        charcoal: '#2B2A4C',
        slate: '#4D4D7A',
        steel: '#777789',
        stone: '#9D9DAD',
        muted: '#C5C5D6',
        'on-dark': '#FFFFFF',
        'on-dark-muted': 'rgba(255,255,255,0.7)',
        'success-accent': '#3AC267',
        'brand-red': '#FFD1CF',
        'brand-red-dark': '#D43F3F',
        primary: '#050038',
        'on-primary': '#FFFFFF',
        'footer-bg': '#0F0D2E',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        'hero-display': ['80px', { lineHeight: '1.05', letterSpacing: '-2px', fontWeight: '500' }],
        'display-lg': ['60px', { lineHeight: '1.10', letterSpacing: '-1.5px', fontWeight: '500' }],
        h1: ['48px', { lineHeight: '1.15', letterSpacing: '-1px', fontWeight: '500' }],
        h2: ['36px', { lineHeight: '1.20', letterSpacing: '-0.5px', fontWeight: '500' }],
        h3: ['28px', { lineHeight: '1.25', fontWeight: '500' }],
        h4: ['22px', { lineHeight: '1.30', fontWeight: '500' }],
        h5: ['18px', { lineHeight: '1.40', fontWeight: '500' }],
        subtitle: ['18px', { lineHeight: '1.50', fontWeight: '400' }],
        'body-md': ['16px', { lineHeight: '1.50', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '1.50', fontWeight: '400' }],
        caption: ['13px', { lineHeight: '1.40', fontWeight: '400' }],
        'caption-bold': ['13px', { lineHeight: '1.40', fontWeight: '600' }],
        micro: ['12px', { lineHeight: '1.40', fontWeight: '500' }],
        'micro-uppercase': ['11px', { lineHeight: '1.40', letterSpacing: '0.5px', fontWeight: '600' }],
        'button-md': ['14px', { lineHeight: '1.30', fontWeight: '500' }],
        'stat-display': ['64px', { lineHeight: '1.10', letterSpacing: '-1.5px', fontWeight: '500' }],
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '28px',
        feature: '32px',
      },
      boxShadow: {
        'elev-1': 'rgba(5, 0, 56, 0.04) 0px 1px 2px 0px',
        'elev-2': 'rgba(5, 0, 56, 0.06) 0px 4px 12px 0px',
        'elev-3': 'rgba(5, 0, 56, 0.08) 0px 12px 32px -4px',
        'elev-4': 'rgba(5, 0, 56, 0.12) 0px 16px 48px -8px',
      },
    },
  },
  plugins: [],
};

export default config;
```

Load Inter (as the reference app does):

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

## Known divergences & notes

- **Font:** the reference app ships Inter, a neutral grotesque, rather than the rounded-geometric face the look is built around. Documented above as a one-token decision per project.
- `ink` and `ink-deep` are both `#050038` in the reference app; `ink-deep` is kept as a semantic alias for headlines on pastel cards in case the two ever diverge.
- `footer-bg` (`#0F0D2E`) is intentionally a touch warmer than `primary` (`#050038`).
- Dark-mode token values are not defined. If a project needs dark mode, extend this file with a `dark` colour set rather than inverting ad hoc.
- Animation timings: default to 150 to 200ms ease for transitions.
- Marketing components (`hero-band`, `promo-banner`, `footer-region`, pricing surfaces) will not appear in most app builds.
