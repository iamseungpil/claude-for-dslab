#!/usr/bin/env python3
"""
Plot Generator for update-study skill.

실험 로그/CSV에서 metric 시계열을 읽어 학술 논문 스타일의 figure를 생성합니다.

Usage:
    # Multi-subplot training dynamics panel
    python generate_plots.py panel \\
        --data-files baseline.csv filter_on.csv \\
        --labels "Filter OFF" "Filter ON" \\
        --metrics accuracy ratio reward_std count \\
        --title "GSM8K Training Dynamics" \\
        --output figures/fig1_training_dynamics.png

    # Single comparison chart
    python generate_plots.py comparison \\
        --data-files gsm8k.csv mathqa.csv \\
        --labels "GSM8K" "Math QA" \\
        --metric accuracy \\
        --output figures/fig2_comparison.png

    # Single metric trend with annotation
    python generate_plots.py trend \\
        --data-files experiment.csv \\
        --metric unexpected_tool_call_ratio \\
        --annotate "318-345:EXPLOSION (max 56%)" \\
        --output figures/fig3_ratio_explosion.png

Supported input formats:
    - CSV with columns: step, metric1, metric2, ...
    - JSON lines with {"step": N, "metric1": X, ...}
    - W&B exported CSV
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import matplotlib
matplotlib.use("Agg")  # Non-interactive backend
import matplotlib.pyplot as plt
import numpy as np

# Academic paper style
plt.rcParams.update({
    "font.family": "serif",
    "font.size": 11,
    "axes.labelsize": 12,
    "axes.titlesize": 13,
    "legend.fontsize": 10,
    "xtick.labelsize": 10,
    "ytick.labelsize": 10,
    "figure.dpi": 150,
    "savefig.dpi": 150,
    "savefig.bbox": "tight",
    "axes.grid": True,
    "grid.alpha": 0.3,
})

COLORS = ["#1f77b4", "#d62728", "#2ca02c", "#ff7f0e", "#9467bd", "#8c564b"]
MARKERS = ["o", "s", "^", "D", "v", "P"]


def load_data(filepath: str) -> Dict[str, List[float]]:
    """Load metric data from CSV or JSON lines file.

    Returns:
        Dict mapping column names to lists of values.
    """
    path = Path(filepath)

    if path.suffix == ".csv":
        return _load_csv(filepath)
    elif path.suffix in (".json", ".jsonl"):
        return _load_jsonl(filepath)
    else:
        # Try CSV first, then JSONL
        try:
            return _load_csv(filepath)
        except Exception:
            return _load_jsonl(filepath)


def _load_csv(filepath: str) -> Dict[str, List[float]]:
    """Load CSV file without pandas dependency."""
    data: Dict[str, List[float]] = {}
    with open(filepath, "r", encoding="utf-8") as f:
        header = f.readline().strip().split(",")
        for col in header:
            data[col.strip()] = []
        for line in f:
            values = line.strip().split(",")
            for col, val in zip(header, values):
                col = col.strip()
                try:
                    data[col].append(float(val))
                except (ValueError, TypeError):
                    data[col].append(float("nan"))
    return data


def _load_jsonl(filepath: str) -> Dict[str, List[float]]:
    """Load JSON lines file."""
    records = []
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))

    if not records:
        return {}

    data: Dict[str, List[float]] = {k: [] for k in records[0].keys()}
    for rec in records:
        for k in data:
            try:
                data[k].append(float(rec.get(k, float("nan"))))
            except (ValueError, TypeError):
                data[k].append(float("nan"))
    return data


def get_steps(data: Dict[str, List[float]]) -> List[float]:
    """Extract step/epoch column from data."""
    for key in ("step", "Step", "training_step", "epoch", "Epoch", "_step"):
        if key in data:
            return data[key]
    # Fallback: use index
    first_key = next(iter(data))
    return list(range(len(data[first_key])))


def plot_panel(
    data_files: List[str],
    labels: List[str],
    metrics: List[str],
    title: str,
    output: str,
    subplot_titles: Optional[List[str]] = None,
) -> str:
    """Generate multi-subplot training dynamics panel.

    Like Figure 1 in filtering_effect_seungpil_lee_en.pdf:
    4 subplots showing different metrics for each condition.
    """
    n_metrics = len(metrics)
    n_cols = min(n_metrics, 2)
    n_rows = (n_metrics + n_cols - 1) // n_cols

    fig, axes = plt.subplots(n_rows, n_cols, figsize=(6 * n_cols, 4.5 * n_rows))
    fig.suptitle(title, fontsize=14, fontweight="bold", y=1.02)

    if n_metrics == 1:
        axes = np.array([axes])
    axes = np.atleast_2d(axes)

    for file_idx, (filepath, label) in enumerate(zip(data_files, labels)):
        data = load_data(filepath)
        steps = get_steps(data)
        color = COLORS[file_idx % len(COLORS)]
        marker = MARKERS[file_idx % len(MARKERS)]

        for metric_idx, metric in enumerate(metrics):
            row = metric_idx // n_cols
            col = metric_idx % n_cols
            ax = axes[row][col]

            if metric in data:
                values = data[metric]
                ax.plot(
                    steps, values,
                    color=color, marker=marker, markersize=3,
                    label=label, linewidth=1.5, alpha=0.85,
                )

    # Format each subplot
    for metric_idx, metric in enumerate(metrics):
        row = metric_idx // n_cols
        col = metric_idx % n_cols
        ax = axes[row][col]

        subtitle = (subplot_titles[metric_idx]
                    if subplot_titles and metric_idx < len(subplot_titles)
                    else _format_metric_name(metric))
        ax.set_title(f"({chr(97 + metric_idx)}) {subtitle}")
        ax.set_xlabel("Training Step")
        ax.set_ylabel(_format_metric_name(metric))
        ax.legend(loc="best")

    # Hide empty subplots
    total_cells = n_rows * n_cols
    for idx in range(n_metrics, total_cells):
        row = idx // n_cols
        col = idx % n_cols
        axes[row][col].set_visible(False)

    plt.tight_layout()
    os.makedirs(os.path.dirname(output) or ".", exist_ok=True)
    fig.savefig(output)
    plt.close(fig)
    print(f"  Saved: {output}")
    return output


def plot_comparison(
    data_files: List[str],
    labels: List[str],
    metric: str,
    title: str,
    output: str,
    annotations: Optional[List[str]] = None,
) -> str:
    """Generate side-by-side comparison chart.

    Like Figure 3 in filtering_effect_seungpil_lee_en.pdf:
    Two panels comparing the same metric across different conditions.
    """
    n_files = len(data_files)
    fig, axes = plt.subplots(1, n_files, figsize=(6 * n_files, 4.5))
    if n_files == 1:
        axes = [axes]

    fig.suptitle(title, fontsize=14, fontweight="bold", y=1.02)

    for idx, (filepath, label) in enumerate(zip(data_files, labels)):
        ax = axes[idx]
        data = load_data(filepath)
        steps = get_steps(data)

        if metric in data:
            values = data[metric]
            ax.plot(steps, values, color=COLORS[idx], marker=MARKERS[idx],
                    markersize=3, linewidth=1.5, label=label)

        ax.set_title(label, fontweight="bold")
        ax.set_xlabel("Training Step")
        ax.set_ylabel(_format_metric_name(metric))
        ax.legend(loc="best")

        if annotations and idx < len(annotations) and annotations[idx]:
            ax.annotate(
                annotations[idx],
                xy=(0.5, 0.95), xycoords="axes fraction",
                ha="center", va="top", fontsize=10,
                bbox=dict(boxstyle="round,pad=0.3", fc="yellow", alpha=0.7),
            )

    plt.tight_layout()
    os.makedirs(os.path.dirname(output) or ".", exist_ok=True)
    fig.savefig(output)
    plt.close(fig)
    print(f"  Saved: {output}")
    return output


def plot_trend(
    data_files: List[str],
    labels: List[str],
    metric: str,
    title: str,
    output: str,
    annotate_ranges: Optional[List[str]] = None,
    threshold: Optional[float] = None,
) -> str:
    """Generate single metric trend with optional annotations.

    Like Figure 6 in filtering_effect_seungpil_lee_en.pdf:
    Ratio explosion plot with annotated regions.

    annotate_ranges format: ["start-end:label", ...]
        e.g., ["318-345:EXPLOSION (max 56%)"]
    """
    fig, ax = plt.subplots(1, 1, figsize=(10, 5))
    ax.set_title(title, fontsize=14, fontweight="bold")

    for idx, (filepath, label) in enumerate(zip(data_files, labels)):
        data = load_data(filepath)
        steps = get_steps(data)

        if metric in data:
            values = data[metric]
            ax.plot(steps, values, color=COLORS[idx], linewidth=1.5,
                    label=label, alpha=0.85)

    # Threshold line
    if threshold is not None:
        ax.axhline(y=threshold, color="gray", linestyle="--", alpha=0.7,
                    label=f"Warning threshold ({threshold}%)")

    # Annotated regions
    if annotate_ranges:
        for annotation in annotate_ranges:
            parts = annotation.split(":")
            if len(parts) == 2:
                range_str, ann_label = parts
                start, end = map(int, range_str.split("-"))
                ax.axvspan(start, end, alpha=0.15, color="red",
                           label=ann_label)
                ax.annotate(
                    ann_label, xy=((start + end) / 2, ax.get_ylim()[1] * 0.9),
                    ha="center", fontsize=9, fontweight="bold",
                    bbox=dict(boxstyle="round,pad=0.3", fc="lightyellow", ec="red"),
                )

    ax.set_xlabel("Training Step")
    ax.set_ylabel(_format_metric_name(metric))
    ax.legend(loc="best")

    plt.tight_layout()
    os.makedirs(os.path.dirname(output) or ".", exist_ok=True)
    fig.savefig(output)
    plt.close(fig)
    print(f"  Saved: {output}")
    return output


def _format_metric_name(metric: str) -> str:
    """Convert metric key to readable label."""
    replacements = {
        "accuracy": "Validation Accuracy (%)",
        "val_accuracy": "Validation Accuracy (%)",
        "loss": "Training Loss",
        "train_loss": "Training Loss",
        "entropy_loss": "Entropy Loss",
        "reward_std": "Reward Standard Deviation",
        "unexpected_tool_call_ratio": "Unexpected Tool Call Ratio (%)",
        "n_unexpected_tool_calls": "Unexpected Tool Call Count",
        "count": "Count",
    }
    return replacements.get(metric, metric.replace("_", " ").title())


def main():
    parser = argparse.ArgumentParser(
        description="Generate publication-quality plots for experiment reports"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Panel command
    panel_parser = subparsers.add_parser("panel", help="Multi-subplot training dynamics")
    panel_parser.add_argument("--data-files", nargs="+", required=True)
    panel_parser.add_argument("--labels", nargs="+", required=True)
    panel_parser.add_argument("--metrics", nargs="+", required=True)
    panel_parser.add_argument("--subplot-titles", nargs="+", default=None)
    panel_parser.add_argument("--title", default="Training Dynamics")
    panel_parser.add_argument("--output", required=True)

    # Comparison command
    comp_parser = subparsers.add_parser("comparison", help="Side-by-side comparison")
    comp_parser.add_argument("--data-files", nargs="+", required=True)
    comp_parser.add_argument("--labels", nargs="+", required=True)
    comp_parser.add_argument("--metric", required=True)
    comp_parser.add_argument("--annotations", nargs="+", default=None)
    comp_parser.add_argument("--title", default="Comparison")
    comp_parser.add_argument("--output", required=True)

    # Trend command
    trend_parser = subparsers.add_parser("trend", help="Single metric trend")
    trend_parser.add_argument("--data-files", nargs="+", required=True)
    trend_parser.add_argument("--labels", nargs="+", required=True)
    trend_parser.add_argument("--metric", required=True)
    trend_parser.add_argument("--annotate", nargs="+", default=None,
                              help="Annotate ranges: 'start-end:label'")
    trend_parser.add_argument("--threshold", type=float, default=None)
    trend_parser.add_argument("--title", default="Metric Trend")
    trend_parser.add_argument("--output", required=True)

    args = parser.parse_args()

    if args.command == "panel":
        plot_panel(
            data_files=args.data_files,
            labels=args.labels,
            metrics=args.metrics,
            title=args.title,
            output=args.output,
            subplot_titles=args.subplot_titles,
        )
    elif args.command == "comparison":
        plot_comparison(
            data_files=args.data_files,
            labels=args.labels,
            metric=args.metric,
            title=args.title,
            output=args.output,
            annotations=args.annotations,
        )
    elif args.command == "trend":
        plot_trend(
            data_files=args.data_files,
            labels=args.labels,
            metric=args.metric,
            title=args.title,
            output=args.output,
            annotate_ranges=args.annotate,
            threshold=args.threshold,
        )


if __name__ == "__main__":
    main()
