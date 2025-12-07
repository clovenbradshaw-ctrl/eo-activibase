# UI Refinement Guidelines

This document captures the current UI refinement direction for modals and supporting controls. Use it as the single source of truth when updating the design system or implementing component-level changes.

## Design Principles
- Reduce rounded corners to a 6–8px radius and tighten padding by roughly 20–30% for a professional feel.
- Favor a neutral gray palette with subtle shadows over heavy borders.
- Establish a clear typography hierarchy (weights at 500–600 for emphasis; size scale: 11, 12, 13, 14, 16, 20px).
- Keep interactions refined: understated hover states and 3px blue focus rings.
- Standardize spacing with 8px, 12px, and 16px gaps.

## Color Palette
Use these CSS variables across components:

```css
--primary: #0f172a;
--primary-hover: #1e293b;
--accent: #3b82f6;
--accent-light: #eff6ff;

--text-primary: #0f172a;
--text-secondary: #475569;
--text-muted: #64748b;
--text-disabled: #94a3b8;

--border: #e2e8f0;
--border-hover: #cbd5e1;
--border-strong: #94a3b8;

--surface: #ffffff;
--surface-hover: #f8fafc;
--surface-muted: #f1f5f9;
--background: #fafbfc;
```

## Component Playbooks

### 1) Popup Field Visibility Modal
- Container: radius 8px; padding 20px 24px.
- Field cards: radius 6px; padding 16px; margin-bottom 12px; 1px border with hover shadow (0 2px 8px rgba(0,0,0,0.04)).
- Field type label: 11px, uppercase, letter-spacing 0.05em, #64748b, weight 500.
- Control groups: flex, center aligned, 8px gap; labels at 12px, #475569, weight 500.
- Select/input: padding 8px 12px; radius 6px; 13px font; 1px border #cbd5e1; focus ring 3px accent shadow.

### 2) Field Type Dropdown/Selector
- Replace native select with a button trigger styled with a 6px radius, 10px × 12px padding, neutral border, hover border-darkening, and active focus ring.
- Dropdown menu: absolute overlay, 6px radius, bordered, shadowed (0 8px 24px rgba(0,0,0,0.12)), max-height 400px with scroll.
- Options: 10px × 12px padding, 12px gap, divider lines (#f1f5f9), hover background #f8fafc; selected option uses #eff6ff background with 3px accent border-left.
- Icon chips: 32px square, 6px radius, neutral background; selected state flips to accent background with white icon. Suggested icons—Text: 📝, Number: 🔢, Date: 📅, Single Select: 📋, Multiple Select: ☑️, Link: 🔗, Checkbox: ✅, Email: 📧, URL: 🌐, Phone: 📞.

### 3) Kanban Configuration Modal
- Modal sizing: introduce `.modal.medium` at max-width 700px.
- Form groups: 20px spacing; labels 13px/600 weight/#475569; hints 12px/#94a3b8 with 6px top margin.
- Preview section: 6px radius, 1px border, 16px padding, light surface background; label is uppercase 12px/600 with letter spacing.
- Preview layout: horizontal scrollable columns (min-width 180px) using neutral borders; cards with light backgrounds, 4px radius, 12px/8px padding structure.

### 4) Filter Builder Modal
- Filter group wrapper: 6px radius, 16px padding, light background, 1px border, 12px bottom spacing.
- Header layout: flex with space-between alignment.
- AND/OR toggle: inline-flex pill with 6px radius; neutral border; buttons at 12px/600, hover transitions, active state uses accent fill and white text.
- Filter rule rows: grid with three equal columns + action column; 8px gap; 10px padding; 6px radius; 1px border; white background.

### 5) Sort Configuration Modal
- Sort rule row: flex with 10px gap, 12px padding, 6px radius, light background/border; handle label 12px/700/#94a3b8 with 28px min-width.
- Selects expand to fill available space; action buttons grouped with 4px gaps.
- Sequence badge: inline-flex, 6px radius, 4px × 8px padding, gray background/text, 13px size with icon support to explain ordering.

### 6) Info Boxes / Alerts
- Base style: radius 6px; 12px padding; flex layout with 12px gap.
- Defaults: info background #eff6ff with #bfdbfe border; warning #fef3c7/#fde68a; success #d1fae5/#a7f3d0.
- Typography: titles 13px/600/#0f172a; body 12px/#475569 with 1.5 line-height.

### 7) Buttons
- Base: padding 9px 18px; radius 6px; 14px font at 500 weight; inline-flex alignment with 6px gaps; 0.2s transitions; border 1px solid transparent.
- Primary: #0f172a background/border with hover #1e293b and slight lift (-1px translateY).
- Secondary: white background, #cbd5e1 border, #475569 text; hover adds #f8fafc background and darker border.
- Ghost: transparent background/borderless; hover background #f1f5f9.
- Small variant: 6px × 12px padding; 13px font.

### 8) Modal Headers & Footers
- Header: 20px × 24px padding; 1px bottom border; #fafbfc background.
- Title group: h2 at 20px/600/#0f172a with 4px bottom margin; subtitle at 13px/#64748b with 1.5 line-height.
- Footer: 16px × 24px padding; 1px top border; #f8fafc background; spaced flex layout.
- Close button: icon-only button with subtle hover background (#f1f5f9), 24px font, 4px radius, and color shift from #94a3b8 to #475569.

## Implementation Checklist
- Border radii standardized to 6–8px; padding reduced ~20–30% from prior bubbly styles.
- Typography follows the 11–20px scale with weights 500–600 for emphasis.
- Updated gray palette, subtle hover transitions, and 3px accent focus rings applied.
- Spacing system uses 8px/12px/16px gaps.
- Icons added where they improve scanability (especially in dropdowns and cards).
- Shadows kept subtle (e.g., hover shadow 0 2px 8px rgba(0,0,0,0.04)).
