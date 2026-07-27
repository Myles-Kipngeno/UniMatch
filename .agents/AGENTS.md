# Workspace Rules & Guidelines

## 1. Responsive Cross-Device UI Requirement
- **Mandatory Fit Across All Devices**: Whenever fixing, adding, or modifying any UI component or page, ALWAYS ensure the layout cleanly adapts and fits every device viewport:
  - **Mobile Phones (< 768px)**: Fluid layouts, dynamic viewport height units (`100dvh`), iOS/Android safe area padding (`env(safe-area-inset-bottom)`), and no horizontal overflow/clipping.
  - **Tablets & Desktops (>= 768px)**: Centered multi-column layouts or responsive container widths (e.g. desktop split views or maximum content widths), ensuring crisp ergonomics across widescreen displays.
