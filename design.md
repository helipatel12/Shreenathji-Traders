# Design — Shreenath Traders Management

## 1. Direction

**Superseded 2026-07-24** — this app originally used a physical bahi-khata
(paper ledger) visual identity (ruled lines, ink/paper colors, a red
margin rule). The owner reviewed a modern SaaS reference (a light,
card-based login screen with a dark-green accent and a decorative side
panel) and chose to fully switch the app's visual identity to that
direction, across every screen, not just login. See `memory.md`'s
decisions log for the full context.

The new direction: clean, light, modern SaaS — white/near-white
surfaces, a single confident dark-green accent color, soft rounded
cards with gentle shadows, generous whitespace, sans-serif type
throughout. Floating cards over a decorative (illustrated, not
photographic) side panel on wider screens.

What carries over unchanged from the original brief, because it comes
from prd.md, not from the ledger metaphor: the UI stays Gujarati-first
with the business's actual vocabulary (કેશ મેમો, વેપારી દાખલા, રોજમેળ,
જણસે સિલક — prd.md §3), numbers stay tabular for legibility in a money
app, and the accessibility floor (§8 below) is unchanged.

Avoid: anything that reads as a photographic stock-image template —
illustrations/decorative panels should be original, simple, abstract
shapes in the app's own palette, not literal photography.

## 2. Color palette

| Token | Hex | Use |
|---|---|---|
| `--surface` | `#FFFFFF` | Main background, cards |
| `--surface-muted` | `#F6F7F5` | Page background behind cards, subtle section fills |
| `--ink` | `#1A1E1B` | Primary text |
| `--ink-muted` | `#6B7268` | Secondary text, labels, placeholders |
| `--accent` | `#2B4238` | Primary buttons, active states, links — deep forest green |
| `--accent-hover` | `#233631` | Hover/pressed state for the accent |
| `--accent-soft` | `#E7ECE8` | Soft accent fills (badges, selected rows) |
| `--success` | `#3F6B4A` | Cleared/paid states, positive amounts |
| `--danger` | `#B3413A` | Errors, destructive actions, negative/debit amounts |
| `--border` | `#E5E7E2` | Card borders, dividers, input borders |

Dark mode is still not a priority for v1 (business-hours utility app used in daylight).

## 3. Typography

| Role | Typeface | Notes |
|---|---|---|
| Headings | **Inter** (semibold) | Clean sans-serif, no serif display face — matches the modern direction. |
| Body / UI text | **Noto Sans Gujarati** + **Inter** (Latin fallback) | Same pairing as before; still the right choice for legible Gujarati + Latin at small sizes. |
| Numbers / amounts | **Inter, tabular-nums** | Unchanged from the original brief — this is a money-app legibility requirement independent of visual style, so it stays. |

Type scale: restrained — 4 sizes (display, heading, body, caption), 2 weights per face (regular + semibold), same discipline as before.

## 4. Layout

- **Cards, not paper**: content lives in white, rounded cards (`rounded-2xl`) with a soft shadow, sitting on the `--surface-muted` page background — the opposite of the old flat, hairline-divided paper surfaces.
- **Mobile-first**: bottom tab bar (5 tabs: Home, Bill, Dakhla, Rojmer, Silak; Settings under a profile icon) — this structural decision is unchanged from before, only the visual skin changes.
- **Desktop**: left sidebar nav instead of bottom tabs; wider tables with visible column headers.
- **Decorative side panel**: on login/auth and similar wide-format screens, a dark-green decorative panel with simple abstract organic shapes (original artwork, not stock photography) sits alongside the white form card, echoing the reference's split-panel composition.
- **Entry numbering**: still shown on bill/dakhla/rojmer rows (નોંધ નં.) — still useful for manually cross-referencing a digital entry to the physical paper bill (no in-app photo is stored — see prd.md §6), unrelated to the ledger visual metaphor being dropped.

## 5. Signature element

**The cleared badge.** When a rojmer entry is fully paid, a small rounded pill badge in `--success` with a checkmark fades and scales in next to it, with the date. Same underlying moment (a payment clearing) as before, restyled as a clean modern badge instead of a textured ink stamp.

## 6. Motion

Minimal, purposeful only:
- The cleared badge above fades + scales in on the moment a balance clears.
- Screen/tab transitions use a simple fade or slide, nothing elaborate.
- Respect `prefers-reduced-motion` — disable non-essential animation, use instant state changes.

## 7. Voice (UI copy)

Unchanged from the original brief — this was never about the ledger metaphor:
- Written from the user's side: "Balance cleared" not "Transaction status updated."
- Errors state what happened and what to do: "Couldn't reach the internet — bill saved on this phone, will sync automatically" not "Network error."
- Empty states are an invitation to act: an empty Rojmer tab says "No pending payments — nice and clear" not just "No data."
- Gujarati vocabulary matches what's already used on paper (કેશ મેમો, વેપારી દાખલા, રોજમેળ, જણસે સિલક) — never invent new translated terms for things that already have a name in this business.

## 8. Accessibility floor

Unchanged:
- Text contrast: `--ink` on `--surface` and `--surface-muted` meets WCAG AA at body sizes.
- All tap targets ≥44px (used one-handed, often outdoors, sometimes with dusty/wet hands).
- Visible keyboard focus states for desktop use.
- Amount fields use numeric keyboards on mobile.
