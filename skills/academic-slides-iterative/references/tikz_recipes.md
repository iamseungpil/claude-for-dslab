# TikZ recipes

Proven patterns to reuse. Every one compiles under Metropolis Beamer with
the preamble:

```latex
\usepackage{tikz}
\usetikzlibrary{positioning, arrows.meta, shapes, shapes.geometric,
                calc, fit, backgrounds}
\tikzset{
  box/.style={draw, rounded corners, align=center, font=\scriptsize,
              minimum height=0.75cm, minimum width=2.3cm},
  decision/.style={draw, diamond, aspect=2, align=center, font=\scriptsize,
                   minimum height=0.6cm, inner sep=1pt},
  arr/.style={-{Latex[length=1.6mm]}, thick},
  arrd/.style={-{Latex[length=1.6mm]}, thick, dashed},
}
```

---

## Recipe 1 — Decision flowchart with a side spine

Used for "one turn, 4 branches" slides: left column of diamonds, right
column of branch outcomes, merged into a vertical spine on the far
right that feeds the shared tail.

```latex
\resizebox{!}{0.82\textheight}{%
\begin{tikzpicture}[node distance=0.35cm and 1.1cm]
  \node[box,fill=black!5] (start) {turn start};
  \node[decision,below=of start]             (dA) {skill running?};
  \node[decision,below=0.35cm of dA]         (dB) {explore phase?};
  \node[decision,below=0.35cm of dB]         (dC) {gate ok?};
  \node[box,below=0.35cm of dC,fill=blue!8]  (D)  {\textbf{(d)} LLM turn};
  \node[box,fill=blue!8,right=of dA] (A) {\textbf{(a)} skill.next};
  \node[box,fill=blue!8,right=of dB] (B) {\textbf{(b)} least-tried};
  \node[box,fill=blue!8,right=of dC] (C) {\textbf{(c)} MCTS.plan};
  % merge points (to the right of each branch box)
  \node[coordinate] (mA) at ($(A.east) + (0.8,0)$) {};
  \node[coordinate] (mB) at ($(B.east) + (0.8,0)$) {};
  \node[coordinate] (mC) at ($(C.east) + (0.8,0)$) {};
  \node[box,fill=black!5,below=1.2cm of mC,anchor=north] (tail) {tail};
  \draw[arr] (start) -- (dA);
  \draw[arr] (dA) -- node[above,font=\tiny]{y} (A);
  \draw[arr] (dA) -- node[left,font=\tiny]{n} (dB);
  \draw[arr] (dB) -- node[above,font=\tiny]{y} (B);
  \draw[arr] (dB) -- node[left,font=\tiny]{n} (dC);
  \draw[arr] (dC) -- node[above,font=\tiny]{y} (C);
  \draw[arr] (dC) -- node[left,font=\tiny]{n} (D);
  \draw[arr] (A.east) -- (mA);
  \draw[arr] (B.east) -- (mB);
  \draw[arr] (C.east) -- (mC);
  \draw[arr] (D.east) -| (mC);
  \draw (mA) -- (mC);
  \draw[arr] (mC) -- (tail.north);
\end{tikzpicture}}
```

### Pitfalls

- Never draw `(A) |- (tail)` for three parallel branches — arrows
  collide. Use a shared spine with explicit merge coordinates.
- If the spine is shorter than `0.8cm` the arrows look bent; use
  `0.8cm` horizontal offset from branch boxes to spine.

---

## Recipe 2 — Module map with cross-module links routed below

Used for "4 modules on a bridge" slides: top row env-agent-TRAPI,
middle SharedBridge bus, bottom row of modules.
Cross-module (simulate_step, commit) links are routed **below** the
modules through explicit via-points so their labels do not land on
module boxes.

```latex
\resizebox{0.98\textwidth}{!}{%
\begin{tikzpicture}[node distance=0.7cm and 1.1cm,
  bus/.style={draw, rounded corners, align=center, font=\small,
              minimum height=0.7cm, minimum width=10cm, fill=black!10}]
  \node[box,fill=black!5] (agent) {agent};
  \node[box,fill=black!5,left=1.8cm of agent]  (env)  {env};
  \node[box,fill=black!5,right=1.8cm of agent] (trapi){LLM};
  \node[bus,below=1.1cm of agent] (br){SharedBridge};
  \node[box,below=1.2cm of br,xshift=-3.5cm] (wm) {WorldCoder};
  \node[box,below=1.2cm of br,xshift=0cm]    (dc) {DreamCoder};
  \node[box,below=1.2cm of br,xshift=3.5cm]  (pl) {MCTSPlanner};
  \draw[arr] (env) -- (agent);  \draw[arr] (agent) -- (trapi);
  \draw[arr] (agent.south) -- (br.north);
  \foreach \x/\l in {wm/u_t, dc/s, pl/p}
    \draw[arrd] (\x.north) -- node[right,font=\tiny]{\l} (\x.north|-br.south);
  % cross-links routed BELOW
  \node[coordinate,below=1.4cm of wm] (vw) {};
  \node[coordinate,below=1.4cm of pl] (vp) {};
  \draw[arr,<->] (wm.south) |-
    node[pos=0.8,above,font=\tiny]{simulate\_step} (vw) -- (vp) -| (pl.south);
\end{tikzpicture}}
```

### Pitfalls

- Placing `simulate_step` as a straight line between WorldCoder and
  MCTSPlanner cuts through the DreamCoder box. Always route below.
- Use `to[bend right=30]` only when there are no boxes on the bend
  path — for three-across layouts it is safer to use the `|- vw -- vp
  -|` pattern with coordinates.

---

## Recipe 3 — I/O box pair (input above, output below)

Used for "real turn IN / OUT" slides. Two separate `Verbatim` blocks,
each on its own slide. Never combine them on one slide.

```latex
\begin{frame}[fragile]{Real turn IN (user\_msg)}
\begin{Verbatim}[fontsize=\tiny,frame=single]
<actual user_msg content pulled verbatim from a run>
\end{Verbatim}
\end{frame}

\begin{frame}[fragile]{Real turn OUT (submit\_action)}
\begin{Verbatim}[fontsize=\tiny,frame=single]
<actual submit_action payload verbatim>
\end{Verbatim}
\end{frame}
```

### Pitfalls

- If you paste a full `world_update` code block, drop fontsize to
  `\tiny`. `\scriptsize` cannot hold more than about 14 code lines.
- Always show the real field names (`predict`, `world_update`,
  `propose_skill`, `env_note`) rather than prose paraphrases.

---

## Recipe 4 — Commit loop (planning → act → wake → sleep)

Horizontal flow with a loopback arrow beneath. Good for showing the
recurring structure of the system.

```latex
\resizebox{0.98\textwidth}{!}{%
\begin{tikzpicture}[node distance=0.4cm and 0.5cm]
  \node[box] (p) {plan};      \node[box,right=of p] (c) {commit};
  \node[box,right=of c] (n)   {next\_action};
  \node[box,right=of n] (s)   {submit\_action};
  \node[box,below=0.6cm of s] (o){on\_skill\_step};
  \node[box,left=of o] (w) {wake\_overlay};
  \node[box,left=of w] (r) {sleep\_refactor};
  \draw[arr] (p) -- (c); \draw[arr] (c) -- (n); \draw[arr] (n) -- (s);
  \draw[arr] (s.south) -- (o.north);
  \draw[arr] (o) -- (w); \draw[arr] (w) -- (r);
  \draw[arr] (r.north) to[bend left=25] (p.south);
\end{tikzpicture}}
```

### Pitfalls

- `to[bend left=N]` with `N > 35` pushes the arrow off the slide.
  30-ish is the safe maximum.
- Do not have two boxes with the same label — the loopback makes them
  look like cycles, so each node name must be unique.
