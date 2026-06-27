# Animations and Interactions

## Animations with Framer Motion

Framer Motion is the recommended animation library for React/Next.js apps. It works well with React 19 and Tailwind.

**Install:**
```bash
npm install framer-motion
```

**Common patterns:**

```tsx
'use client';
import { motion } from 'framer-motion';

// Fade in on mount
export function FadeIn({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {children}
    </motion.div>
  );
}

// Staggered list
export function StaggerList({ items }: { items: string[] }) {
  return (
    <motion.ul
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.1 } },
      }}
    >
      {items.map((item) => (
        <motion.li
          key={item}
          variants={{
            hidden: { opacity: 0, x: -10 },
            visible: { opacity: 1, x: 0 },
          }}
        >
          {item}
        </motion.li>
      ))}
    </motion.ul>
  );
}

// Hover scale
<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
  Click me
</motion.button>
```

**Accessibility:** Respect `prefers-reduced-motion` by disabling animations when the media query matches.

## Draggable Images

### Simple: react-draggable

```bash
npm install react-draggable
```

```tsx
'use client';
import Draggable from 'react-draggable';

export function MovableImage({ src }: { src: string }) {
  return (
    <Draggable>
      <img src={src} alt="movable" className="cursor-move rounded shadow" />
    </Draggable>
  );
}
```

### Advanced: @dnd-kit

Use `@dnd-kit/core` + `@dnd-kit/utilities` for sortable lists or constrained drag contexts.

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**When to use which:**

- **react-draggable**: Quick free-form dragging on a canvas.
- **@dnd-kit**: Sortable lists, drag-to-reorder, or constrained drop zones.

## Micro-Interactions

Use Tailwind transitions for simple hover/focus states before adding JS animation libraries:

```html
<button className="transition-colors duration-200 hover:bg-blue-600 focus:ring-2">
  Save
</button>
```
