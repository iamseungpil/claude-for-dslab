# Artifact Design Patterns

Visual design patterns for research visualization artifacts.

## Core Principles

### 1. Abstraction Over Notation

❌ Bad: "We minimize L = Σᵢ wᵢ·∇θJ(θ) where wᵢ ∝ 1/Lᵢ"
✓ Good: Visual showing "Long response → Small weight → Balanced gradient"

### 2. Comparison-Centric

Every method should be explained relative to what came before:
- What baseline does
- Why baseline fails
- How new method fixes it

### 3. Progressive Complexity

Start simple, add detail on demand:
- Overview first (one-line summary)
- Then key insight
- Then full architecture
- Then comparison table

## Architecture Diagram Patterns

### Pattern 1: Linear Pipeline

```
Input → Stage 1 → Stage 2 → Stage 3 → Output
```

Use for: Sequential processing methods (most common)

```jsx
<div className="flex items-center gap-2">
  <Box label="Input" />
  <Arrow />
  <Box label="Process" color="blue" />
  <Arrow />
  <Box label="Output" color="green" />
</div>
```

### Pattern 2: Before/After Split

```
┌─────────────┐     ┌─────────────┐
│   Before    │     │    After    │
│  (Baseline) │ vs  │  (Ours)     │
└─────────────┘     └─────────────┘
```

Use for: Methods that replace/improve existing approaches

### Pattern 3: Multi-Stage Vertical

```
Stage 1: [Description]
    ↓
Stage 2: [Description]
    ↓
Stage 3: [Description]
```

Use for: Methods with distinct phases (like OPA-DPO's 4-step process)

### Pattern 4: Grid/Matrix

```
┌────┬────┬────┐
│ A  │ B  │ C  │
├────┼────┼────┤
│ D  │ E  │ F  │
└────┴────┴────┘
```

Use for: Attention patterns, comparison matrices

### Pattern 5: Tree/Branch

```
        Input
       /     \
    Path A   Path B
       \     /
        Merge
```

Use for: Methods with conditional processing

## Visual Components

### Problem Visualization

Show the problem visually, not just describe it:

```jsx
// BAD: Just text
<p>The attention complexity is O(n²) which is slow</p>

// GOOD: Visual representation
<div className="flex justify-between">
  <div>
    <div className="text-4xl text-red-400">n²</div>
    <div className="text-xs">1M² = 1조 연산</div>
  </div>
  <ArrowRight />
  <div>
    <div className="text-4xl text-green-400">n</div>
    <div className="text-xs">선형 복잡도</div>
  </div>
</div>
```

### Comparison Table Structure

```jsx
<table>
  <thead>
    <tr>
      <th>Method</th>
      <th>Limitation ❌</th>
      <th>Our Solution ✓</th>
    </tr>
  </thead>
  <tbody>
    {baselines.map(b => (
      <tr>
        <td>{b.name}</td>
        <td className="text-red-400">{b.limitation}</td>
        <td className="text-green-400">{b.solution}</td>
      </tr>
    ))}
  </tbody>
</table>
```

### Key Insight Box

```jsx
<div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-3">
  <div className="text-yellow-400 font-bold">💡 핵심 발견</div>
  <p className="text-gray-300">{insight}</p>
</div>
```

### Metrics Display

```jsx
<div className="grid grid-cols-3 gap-2">
  {metrics.map(m => (
    <div className="text-center bg-gray-800 rounded-lg p-2">
      <div className="text-2xl font-bold text-gradient">{m.value}</div>
      <div className="text-xs text-gray-400">{m.label}</div>
    </div>
  ))}
</div>
```

## Color Conventions

| Purpose | Color | Tailwind Class |
|---------|-------|----------------|
| Problem/Error | Red | `text-red-400`, `bg-red-900/30` |
| Solution/Success | Green | `text-green-400`, `bg-green-900/30` |
| Key Insight | Yellow | `text-yellow-400`, `bg-yellow-900/30` |
| Method/Process | Blue/Cyan | `text-blue-400`, `text-cyan-400` |
| Neutral/Data | Gray | `text-gray-400`, `bg-gray-800` |

## Navigation Pattern

For multi-paper surveys, use tab navigation:

```jsx
const [currentPage, setCurrentPage] = useState(0);

<div className="flex gap-1">
  {papers.map((paper, i) => (
    <button
      onClick={() => setCurrentPage(i)}
      className={i === currentPage ? 'bg-blue-500' : 'bg-gray-700'}
    >
      {paper.shortName}
    </button>
  ))}
</div>
```

## Responsive Design

- Use `grid-cols-1 lg:grid-cols-2` for two-column layouts
- Keep architecture diagrams in left column
- Put text explanations in right column
- Ensure mobile readability with `text-sm` base size

## Icons (from lucide-react)

```jsx
import { 
  Zap,        // Speed/efficiency
  Brain,      // Memory/intelligence  
  Database,   // Storage/caching
  Eye,        // Vision/hallucination
  Calculator, // Math/optimization
  Check,      // Success/solution
  X,          // Failure/limitation
  ArrowRight, // Flow/transformation
  ArrowDown,  // Sequential steps
} from 'lucide-react';
```
