---
name: app-showcase-design
description: Build polished showcase features in a Next.js proposal review app, including interactive roadmaps, animated UI, draggable images, data visualizations, and free analytics integration. Use when the user asks for roadmap diagrams, better UI, animations, movable images, analysis dashboards, or analytics setup in the app.
---

# App Showcase Design

Use this skill when improving the visual presentation and interactivity of the proposal-review-app. It covers roadmap diagrams, UI polish, animations, drag-and-drop images, analysis charts, and privacy-friendly analytics.

## When to Use

- Adding a roadmap, timeline, or flow diagram to the app.
- Improving UI components, layout, or visual hierarchy.
- Adding page transitions, micro-interactions, or scroll animations.
- Making images or cards draggable/movable.
- Building analysis dashboards or scorecards.
- Integrating free web or product analytics.

## Core Guidance

1. **Prefer existing stack**: The app uses Next.js 16, React 19, Tailwind CSS 4, and Recharts. Prefer libraries that work well with this stack and avoid heavy alternatives unless justified.

2. **Keep it client-safe**: Next.js 16 defaults may still require `'use client'` for browser-only libraries (canvas, drag-and-drop, Mermaid). Mark those components accordingly.

3. **Use lightweight, free tools**: For analytics, prefer free/open-source or generous-free-tier tools. See [references/analytics-options.md](references/analytics-options.md) for a decision matrix.

4. **Progressive enhancement**: Start with static or simple interactive elements, then layer animations and drag-and-drop. Ensure accessibility (keyboard focus, reduced motion) is not broken.

## Feature Patterns

| Feature | Recommended Approach | Key Libraries |
|---------|---------------------|---------------|
| Roadmap / Timeline | Mermaid text-based diagrams or React Flow node-based canvas | `mermaid`, `@xyflow/react` |
| Better UI | Tailwind + shadcn/ui-style components or Radix primitives | `class-variance-authority`, `@radix-ui/*` |
| Animations | Declarative React animations | `framer-motion` |
| Movable images/cards | HTML5 drag-and-drop or modern dnd kit | `react-draggable`, `@dnd-kit/core` |
| Analysis / charts | Recharts (already installed) or lightweight custom SVG | `recharts` |
| Analytics | Privacy-first web analytics or product analytics | See analytics-options reference |

## Workflow

1. Ask the user which showcase feature they want to add.
2. Pick the recommended stack from the table above.
3. Install only the needed package(s).
4. Create a client component that wraps the library.
5. Add a demo usage in an existing page or a new `/showcase` route.
6. Verify the dev build compiles and the feature renders.

## References

- [roadmap-and-diagrams.md](references/roadmap-and-diagrams.md) – Roadmap, timeline, and diagram implementation options.
- [animations-and-interactions.md](references/animations-and-interactions.md) – Animations, drag-and-drop, and movable image patterns.
- [analytics-options.md](references/analytics-options.md) – Free analytics tools and integration notes.
