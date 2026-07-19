# UI Context

## Theme

Functional-first, minimal-styling build. No design-system investment planned given the timeline — this file exists to keep the small amount of styling that does happen consistent, not to define a polished visual language. Light backgrounds, system-default fonts, no dark mode.

## Colors

Minimal palette, applied consistently wherever color is used (mobile and web share the same values conceptually, even though they're implemented separately per platform).

| Role            | CSS Variable / Constant | Value                          |
| ---------------- | ------------------------ | ------------------------------- |
| Page background   | `--bg-base`               | `#FFFFFF`                       |
| Surface (cards)    | `--bg-surface`            | `#F5F5F5`                       |
| Primary text       | `--text-primary`          | `#1A1A1A`                       |
| Muted text         | `--text-muted`            | `#6B6B6B`                       |
| Primary accent (CTA/booking actions) | `--accent-primary` | `#2563EB` (blue) |
| Border             | `--border-default`        | `#E0E0E0`                       |
| Error (booking conflict, form errors) | `--state-error` | `#DC2626` (red)     |
| Success (booking confirmed)          | `--state-success` | `#16A34A` (green)  |

## Typography

| Role      | Font                          | Variable      |
| --------- | ------------------------------ | -------------- |
| UI text   | System default (Inter fallback) | `--font-sans` |
| Code/mono | Not used in this build          | —              |

## Border Radius

Minimal, consistent, not a focus area.

| Context           | Value          |
| ------------------ | --------------- |
| Inline / small UI   | `4px`            |
| Cards / panels      | `8px`            |
| Modals / overlays   | `8px`            |

## Component Library

- Web: plain Tailwind utility classes. No shadcn/ui or other component library — not worth the setup time for a read-only/light-interaction dashboard.
- Mobile: React Native core components + basic custom styling. No UI kit (e.g. no NativeBase/Tamagui) — keeps dependencies minimal and avoids time lost to learning a new library mid-sprint.

## Layout Patterns

- Mobile: standard stack navigation (list → detail → action). No tab bar complexity unless the prototype already has one.
- Web dashboard: simple top nav + content area. Rides list is a table; ride detail is a single-column page showing ride info plus a bookings list below it.
- Forms (create ride, login/register): single-column, top-to-bottom, no multi-step wizards.

## Icons

Lucide React (web) / a matching RN-compatible icon set (e.g. `lucide-react-native`) if icons are used at all — kept to a minimum (booking status, back navigation) rather than icon-heavy UI.
