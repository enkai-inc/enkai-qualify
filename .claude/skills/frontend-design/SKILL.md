---
name: frontend-design
description: "Frontend design guide emphasizing intentional aesthetics. Use when implementing UI to avoid generic AI-generated patterns."
---

# Frontend Design Guide

Design guidance for building distinctive, intentional UI — not generic AI slop.

## When to Use

- Before implementing any frontend component
- When `/build` detects frontend work (`.tsx`, `.css`, `.scss` files)
- When creating new pages, layouts, or design systems

## Core Principles

### 1. Intentional Typography

- **Avoid defaults**: Don't reach for Inter, Roboto, or system fonts without reason
- **Hierarchy**: 3-4 font sizes max. Each serves a purpose
- **Weight contrast**: Use bold for emphasis, not color
- **Line height**: 1.4-1.6 for body, 1.1-1.2 for headings

### 2. Color Cohesion

- **Palette**: Define 5-7 colors before writing CSS. Document them
- **Contrast**: WCAG AA minimum (4.5:1 for text, 3:1 for large text)
- **Meaning**: Colors signal state (success, error, warning) — don't dilute with decoration
- **Dark mode**: Design for both from the start, not as an afterthought

### 3. Spatial Composition

- **Consistent spacing**: Use a scale (4, 8, 12, 16, 24, 32, 48, 64)
- **White space**: More is almost always better. Let content breathe
- **Grid alignment**: Every element should align to something
- **Asymmetry**: Intentional asymmetry > accidental symmetry

### 4. Motion & Interaction

- **Purpose**: Animation should communicate state change, not decorate
- **Duration**: 150-300ms for micro-interactions, 300-500ms for page transitions
- **Easing**: Use ease-out for entrances, ease-in for exits
- **Reduce motion**: Respect `prefers-reduced-motion` always

### 5. Anti-Slop Checklist

Before committing frontend work, verify:

- [ ] No default shadows (`shadow-md` without design rationale)
- [ ] No gradient backgrounds unless intentional
- [ ] No rounded corners everywhere (`rounded-lg` on everything)
- [ ] No excessive border usage as visual separation
- [ ] No icon-heavy interfaces without text labels
- [ ] No centered-everything layouts
- [ ] Colors chosen deliberately, not from a random palette
- [ ] Spacing is consistent (single scale used)

## Component Patterns

### Cards
- Content density matters more than decoration
- Remove borders/shadows if the background provides contrast
- Consistent internal padding

### Forms
- Labels always visible (no placeholder-only labels)
- Error messages adjacent to the field
- Logical tab order
- Loading states on submit buttons

### Tables
- Left-align text, right-align numbers
- Minimal borders (horizontal rules only)
- Sticky headers for scrollable tables
- Empty states with helpful messages

## Integration with /build

When the implementer-agent detects frontend work:
1. Reference this guide before writing JSX/CSS
2. Define the visual approach in a comment before coding
3. Use the anti-slop checklist before committing
