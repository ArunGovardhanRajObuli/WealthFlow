---
tags:
  - component
  - ui
  - frontend
aliases:
  - Global Dropdown
file: frontend/src/components/ui/CustomSelect.jsx
type: React Component
---

# CustomSelect

> [!info] Z-Index Portal Escape
> The **CustomSelect** component is a highly specialized UI element designed specifically to solve CSS `overflow: hidden` and `z-index` clipping issues inside of Modals and constrained containers.

## Core Features
1. **React DOM Portals**: Uses `createPortal` to physically rip the dropdown list out of the React component tree and attach it directly to `document.body`, making it absolutely immune to CSS clipping from parent scroll containers or modals.
2. **Dynamic Positioning**: Implements `useLayoutEffect` combined with `getBoundingClientRect()` to measure available screen space. If the user clicks a dropdown at the bottom of the screen, it mathematically calculates the bounds and reverses the dropdown to open upwards instead of downwards.
3. **Array Flattening**: Since it intercepts standard `<option>` React children, it contains a deep recursive parsing algorithm to flatten arrays, Fragments, and natively mapped arrays into a normalized state object to render the dropdown portal accurately.
