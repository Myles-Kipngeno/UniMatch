# Workspace Rules & Guidelines

## 1. Responsive Cross-Device UI Requirement
- **Mandatory Fit Across All Devices**: Whenever fixing, adding, or modifying any UI component or page, ALWAYS ensure the layout cleanly adapts and fits every device viewport:
  - **Mobile Phones (< 768px)**: Fluid layouts, dynamic viewport height units (`100dvh`), iOS/Android safe area padding (`env(safe-area-inset-bottom)`), and no horizontal overflow/clipping.
  - **Tablets & Desktops (>= 768px)**: Centered multi-column layouts or responsive container widths (e.g. desktop split views or maximum content widths), ensuring crisp ergonomics across widescreen displays.

## 2. Strict Change-Scope Rule
- **Explicit Scope Only**: Only modify the page, component, feature, or files explicitly mentioned in the current request. Do not make changes to any other page, component, route, feature, styling, layout, functionality, or shared component unless specifically instructed to do so.
- **Pre-Execution Scope Audit**: Before making changes, identify exactly what was asked to be modified and limit work strictly to that scope.
- **Shared Code / Component Restrictions**: If fixing the requested feature requires changing a shared component or code that affects other pages, do not automatically modify it—first explain what needs to be changed and ask for explicit permission.
- **No Unsolicited Alterations**: Do not "improve," redesign, optimize, refactor, clean up, or alter unrelated parts of the application on your own. Preserve all existing behavior and UI outside the requested scope.
- **Strict Page Scope Enforcement**: A page should only be changed when explicitly told to change that page (e.g., if told "fix the Notifications page," only work on Notifications; if told "fix the mobile Discover page," only work on the mobile Discover page).
- **No Assumptions / Stop When Finished**: After completing the requested change, stop immediately and do not make additional modifications without further instruction.

