# Roadmap and Diagram Options

## Option 1: Mermaid (Text-Based Diagrams)

Best for simple roadmaps, flowcharts, Gantt charts, and sequence diagrams rendered from Markdown-like syntax.

**Install:**
```bash
npm install mermaid
```

**Client component example:**
```tsx
'use client';
import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

export function MermaidRoadmap({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: 'default' });
    if (ref.current) {
      ref.current.innerHTML = chart;
      mermaid.run({ nodes: [ref.current] });
    }
  }, [chart]);

  return <div ref={ref} className="mermaid" />;
}
```

**Usage:**
```tsx
<MermaidRoadmap chart={`
graph LR
  A[Discovery] --> B[Fit-Gap]
  B --> C[Blueprint]
  C --> D[Build]
  D --> E[Deploy]
`} />
```

**Pros:** Lightweight, no layout engine needed, easy to store as text.  
**Cons:** Limited interactivity; styling can be tricky.

## Option 2: React Flow / @xyflow/react (Node-Based Canvas)

Best for interactive node-based roadmaps, workflows, or proposal-stage maps where users can pan, zoom, and click nodes.

**Install:**
```bash
npm install @xyflow/react
```

**Minimal client component:**
```tsx
'use client';
import { ReactFlow, Background, Controls, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const nodes: Node[] = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: 'Stage 1: Qualify' } },
  { id: '2', position: { x: 200, y: 0 }, data: { label: 'Stage 2: Evaluate' } },
  { id: '3', position: { x: 400, y: 0 }, data: { label: 'Stage 3: Select' } },
];

const edges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3' },
];

export function ProposalRoadmap() {
  return (
    <div style={{ height: 300 }}>
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
```

**Pros:** Highly interactive, pan/zoom, custom nodes.  
**Cons:** Larger bundle; needs explicit client component.

## Decision Guidance

- Use **Mermaid** for static proposal roadmaps and quick text-to-diagram features.
- Use **React Flow** when the user needs an interactive canvas with clickable stages or custom node content.
