# Visualization Design Patterns

Design patterns for creating inline Visualizer widgets (`show_widget`) to explain research papers. All widgets render inside the chat — no files, no artifacts.

## Table of Contents

1. Core Principles
2. WHY Widget Patterns (problem experience)
3. WHAT Widget Patterns (structure diagrams)
4. HOW Widget Patterns (solution simulation)
5. EVIDENCE Widget Patterns (comparison)
6. sendPrompt() Integration
7. Multi-Paper Patterns
8. Common Pitfalls

---

## 1. Core Principles

### CRITICAL: No inline event handlers (CSP restriction)

The Visualizer iframe enforces Content Security Policy that **blocks all inline event handlers**. This is the #1 cause of broken interactive widgets.

**NEVER use:**
```html
<button onclick="doThing()">         <!-- BLOCKED -->
<input oninput="update(this.value)"> <!-- BLOCKED -->
<div onmouseover="highlight()">      <!-- BLOCKED -->
<g onclick="sendPrompt('...')">      <!-- BLOCKED in SVG too -->
```

**ALWAYS use addEventListener:**
```html
<button id="my-btn">Click</button>
<input type="range" id="my-slider">
<script>
document.getElementById('my-btn').addEventListener('click', function() {
  doThing();
});
document.getElementById('my-slider').addEventListener('input', function(e) {
  update(e.target.value);
});
</script>
```

**For SVG sendPrompt() on clickable nodes:**
```html
<g class="node c-blue" id="node-entropy">
  <rect .../>
  <text ...>Entropy decay</text>
</g>
<script>
document.getElementById('node-entropy').addEventListener('click', function() {
  sendPrompt('Entropy Decay의 수학적 증명을 설명해줘');
});
</script>
```

This rule applies to ALL widgets — HTML interactive, SVG diagrams, Chart.js controls. No exceptions.

### Narrative drives visualization, not the reverse

Every widget exists to make the reader **feel** something about the paper:
- WHY widget → "oh, this really does break"
- WHAT diagram → "ah, that's the structure"
- HOW widget → "I see, changing this parameter fixes it"

If a widget doesn't produce one of these reactions, replace it with text.

### Insight-first, not information-first

```
BAD:  "The model uses 3 components: A, B, C. A does X..."
GOOD: "Everyone assumed X, but this paper noticed Y. 
       That's why they built A — to exploit Y."
```

The widget should make the **insight** tangible, not just illustrate the **method**.

### Text outside, visuals inside

- All explanatory prose → response text (outside show_widget)
- Only visual elements → inside widget code
- No paragraph-length text inside HTML widgets
- Short labels (≤5 words) and metric values are fine inside widgets

---

## 2. WHY Widget Patterns — Problem Experience

The reader should **directly experience** why existing methods fail.

### Pattern: Parameter-driven failure demonstration

Let user adjust a parameter and watch the existing method break.

**When to use**: The paper addresses a failure that worsens with some variable (sequence length, noise level, iteration count, data ratio, dimensionality).

**Structure**:
```
[Slider: parameter]  →  [Live visualization: method breaking]
[Metric cards: showing degradation]
```

**Design rules**:
- Slider controls one intuitive parameter
- Chart/canvas shows real-time effect
- Metric cards (2-3) show key quantities degrading
- Use Chart.js for line/bar charts, Canvas for distributions/custom visuals
- Start at a "safe" value; user drags toward the failure region
- Brief instruction text at bottom: "Try moving α toward 0..."

**Example scenarios**:
- Model collapse paper → α slider (external data ratio), watch distribution flatten
- Attention scaling paper → sequence length slider, watch compute explode
- Generalization paper → train/test gap slider, watch accuracy diverge

### Pattern: Before/after toggle

Show two states: with and without the problem condition.

**When to use**: The failure is binary or categorical rather than continuous.

**Structure**:
```
[Toggle: condition on/off]  →  [Side-by-side or overlay visualization]
```

---

## 3. WHAT Widget Patterns — Structure Diagrams

Show the paper's core architecture or conceptual framework.

### Pattern: Annotated flowchart (SVG)

For sequential pipelines, feedback loops, multi-stage processes.

**Design rules**:
- Use color ramp classes: `c-purple`, `c-teal`, `c-coral`, `c-amber`, etc.
- Text classes: `th` (14px bold), `ts` (12px secondary), `t` (14px regular)
- Every node clickable with `sendPrompt()` via addEventListener (never inline onclick)
- Max 6-7 nodes per diagram; split into multiple if more
- Include arrow marker in `<defs>`
- viewBox width always 680

**Node patterns**:
```svg
<!-- Single-line node (44px) — give unique id for addEventListener -->
<g class="node c-purple" id="node-label">
  <rect x="X" y="Y" width="W" height="44" rx="8" stroke-width="0.5"/>
  <text class="th" x="CX" y="CY" text-anchor="middle" 
        dominant-baseline="central">Label</text>
</g>

<!-- Two-line node (56px) -->
<g class="node c-teal" id="node-title">
  <rect x="X" y="Y" width="W" height="56" rx="8" stroke-width="0.5"/>
  <text class="th" x="CX" y="CY-9" text-anchor="middle" 
        dominant-baseline="central">Title</text>
  <text class="ts" x="CX" y="CY+9" text-anchor="middle" 
        dominant-baseline="central">Subtitle ≤5 words</text>
</g>

<!-- Bind clicks in <script> at the end -->
<script>
document.getElementById('node-label').addEventListener('click', function() {
  sendPrompt('Label에 대해 더 설명해줘');
});
document.getElementById('node-title').addEventListener('click', function() {
  sendPrompt('Title의 세부 내용을 알려줘');
});
</script>
```

### Pattern: Structural containment (SVG)

For systems with nesting: components inside modules inside systems.

**Design rules**:
- Outer container: large rect, rx=20, lightest fill (50 stop)
- Inner regions: medium rects, rx=12, different color ramp
- 20px min padding inside containers
- Max 2-3 nesting levels

### Pattern: Illustrative mechanism (SVG)

For building intuition about abstract concepts (attention, gradient flow, compression).

**Design rules**:
- Draw the mechanism, not a diagram about the mechanism
- Color encodes intensity (warm = active, cool = dormant)
- Freeform shapes allowed (paths, circles, lines of varying thickness)
- Labels in margins with leader lines, not overlapping the drawing

---

## 4. HOW Widget Patterns — Solution Simulation

The reader should **operate** the paper's proposed method.

### Pattern: Interactive simulation with controls

Let user adjust the paper's key parameter and see the solution working.

**Structure**:
```
[Controls: sliders, toggles, buttons]
[Live visualization: Chart.js or Canvas]
[Metric cards: showing improvement]
[Instruction hint at bottom]
```

**Design rules**:
- Use CSS variables for theming (auto light/dark mode)
- Metric cards: `background: var(--color-background-secondary)`, no border
- Sliders: bare `<input type="range">` with unique `id` (pre-styled by host)
- Buttons: bare `<button>` with unique `id` (pre-styled)
- **All event binding via addEventListener** — never inline `onclick`/`oninput`
- Chart.js: load via CDN `<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js">`
- Canvas wrapper: `position: relative; width: 100%; height: 300px;`
- Round all displayed numbers (`.toFixed()`, `Math.round()`)

**Key interaction patterns**:
- Slider controlling a continuous parameter → real-time chart update
- Toggle comparing two approaches → dataset swap in chart
- Play/pause for animated simulations → requestAnimationFrame loop
- Reset button to return to initial state

### Pattern: Comparative A/B simulation

Let user toggle between baseline and proposed method under same conditions.

**Structure**:
```
[Shared parameter slider]
[Side-by-side: Baseline chart | Proposed chart]
[Metric comparison cards]
```

---

## 5. EVIDENCE Widget Patterns — Quantitative Comparison

### Pattern: Baseline comparison chart (Chart.js)

**Design rules**:
- Disable default legend; build custom HTML legend above chart
- Custom legend format: colored square (10x10, radius 2) + label + value
- Horizontal bar for ≤6 items, vertical bar for time series
- Use `Chart.js` UMD global, not ES modules
- Wrapper div with explicit height, canvas inside
- `responsive: true, maintainAspectRatio: false`

### Pattern: Metric card grid

For 2-4 key numbers comparing baseline vs proposed.

```html
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;">
  <div style="background: var(--color-background-secondary); 
              border-radius: var(--border-radius-md); padding: 1rem;">
    <div style="font-size: 12px; color: var(--color-text-secondary);">Label</div>
    <div style="font-size: 20px; font-weight: 500;">Value</div>
  </div>
  <!-- more cards -->
</div>
```

---

## 6. sendPrompt() Integration

Every SVG diagram node should link to a meaningful follow-up question. **Always bind via addEventListener, never inline onclick.**

### Correct sendPrompt binding (addEventListener)

```html
<!-- In SVG: give each clickable node a unique id -->
<g class="node c-blue" id="node-theorem2">
  <rect x="100" y="20" width="200" height="44" rx="8" stroke-width="0.5"/>
  <text class="th" x="200" y="42" text-anchor="middle" dominant-baseline="central">Theorem 2</text>
</g>

<!-- In <script> block at bottom -->
<script>
document.getElementById('node-theorem2').addEventListener('click', function() {
  sendPrompt('Theorem 2의 증명 과정을 단계별로 설명해줘');
});
</script>
```

### Good sendPrompt questions

```javascript
// Deep-dive into a specific component
sendPrompt('Theorem 2의 증명 과정을 단계별로 설명해줘')

// Compare with alternative
sendPrompt('이 방법과 기존 attention 방식의 차이점을 더 자세히 설명해줘')

// Ask about implications
sendPrompt('이 결과가 LLM 학습 파이프라인에 미치는 실질적 영향은?')
```

### Bad sendPrompt patterns

```javascript
// Too vague
sendPrompt('Tell me more')

// Redundant with what's already shown
sendPrompt('What is this component?')
```

---

## 7. Multi-Paper Patterns

### Unifying theme first

Before any per-paper widgets, show a single SVG mapping the research landscape:
- Nodes = papers, colored by approach type
- Arrows = "builds on" / "contrasts with"
- Each node clickable → sendPrompt() to jump to that paper's explanation

### Per-paper sections

Each paper follows the full WHY→WHAT→HOW sequence, with text headers separating them.

### Cross-paper comparison widget

After all papers, one interactive HTML widget:
- Dropdown or tabs to select comparison dimension
- Side-by-side metrics updating based on selection
- Synthesis text below (in response, not in widget)

---

## 8. Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| **Generating widgets in same response as web_fetch/read_me** | **#1 cause of invisible widgets. Split into separate responses: fetch+analyze first, widgets later.** |
| **3+ widgets in one response** | **Max 2 widgets per response. Split across responses if more needed.** |
| **Verbose widget code (long class/variable names)** | **Use short names: `.sr` not `.sim-row`, `s1` not `stress`. Smaller code = more reliable streaming.** |
| **Inline event handlers (`onclick=""`, `oninput=""`)** | **CSP blocks them — use `addEventListener` in `<script>` block.** |
| Widget with no interactivity called "interactive" | Must have slider, toggle, or click-driven state change |
| Method explained before motivation | Always Context→Insight before Method |
| Jargon in widget labels | Use plain language; define terms in surrounding text |
| Text paragraphs inside widget HTML | Move to response text outside the tool call |
| Too many widgets (6+) overwhelming the chat | Cap at 3-5 total across multiple responses; use sendPrompt() for depth |
| Chart.js with no legend | Always build custom HTML legend |
| SVG text without class (`th`/`ts`/`t`) | Every `<text>` needs a class for proper styling |
| Hard-coded colors instead of CSS variables | Use `var(--color-text-primary)` etc. for HTML; use `c-{ramp}` classes for SVG |
| Widgets stacked without text between them | Always write a bridging paragraph between widgets |
| Static diagram for a dynamic concept | If the concept has a parameter, make it a slider |

### Stability Debugging Checklist

If widgets fail to render ("No result received" or invisible):

1. **Was web_fetch or read_me called in the same response?** → Split into separate responses
2. **Are there 3+ widgets in one response?** → Reduce to max 2
3. **Is widget_code very large (>3KB)?** → Compress class/variable names
4. **Did preceding tool calls return large payloads?** → Move widgets to next response
5. **Test with minimal widget first** (bare `<div>` with red border) to isolate rendering vs code issues
