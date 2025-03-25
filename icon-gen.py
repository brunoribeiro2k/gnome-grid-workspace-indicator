#!/usr/bin/env python3
"""
Beautiful, minimal-dependency script to generate W×H grid SVG icons with one highlighted cell each.
"""
import argparse
from pathlib import Path
import sys

def parse_args():
    parser = argparse.ArgumentParser(
        description="Generate a grid of SVG icons (one highlighted cell per icon)")
    parser.add_argument("-W", "--width", type=int, default=3, help="Number of columns in the grid")
    parser.add_argument("-H", "--height", type=int, default=3, help="Number of rows in the grid")
    parser.add_argument("-M", "--max-size", type=int, default=32, help="Maximum pixel dimension of each icon")
    parser.add_argument("-m", "--min-size", type=int, default=24, help="Minimum pixel dimension of each icon")
    return parser.parse_args()

def compute_dimensions(width: int, height: int, max_size: int, min_size: int):
    """Calculate cell size and total icon dimension, ensuring constraints."""
    max_cells = max(width, height)
    cell_size = max_size // max_cells
    total = cell_size * max_cells
    if total < min_size:
        sys.exit(f"ERROR: computed icon size {total}px < min-size {min_size}px.")
    return cell_size, total

def build_grid_path(width: int, height: int, cell: int) -> str:
    """Return SVG path commands drawing the grid lines."""
    commands = []
    for x in range(1, width):
        commands.append(f"M{x * cell} 0 V{height * cell}")
    for y in range(1, height):
        commands.append(f"M0 {y * cell} H{width * cell}")
    return " ".join(commands)

def generate_svg(width: int, height: int, cell: int, total: int, row: int, col: int, grid_path: str) -> str:
    """Return SVG content string for a single icon highlighting cell (row, col)."""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{total}" height="{total}" viewBox="0 0 {total} {total}">
  <rect x="{col * cell}" y="{row * cell}" width="{cell}" height="{cell}" fill="white"/>
  <path d="{grid_path}" stroke="white" stroke-width="1"/>
</svg>'''

def write_icons(width: int, height: int, cell: int, total: int, grid_path: str):
    """Generate and write SVG files for every grid cell."""
    out_dir = Path.cwd()
    for r in range(height):
        for c in range(width):
            filename = out_dir / f"grid_{r+1}_{c+1}.svg"
            filename.write_text(generate_svg(width, height, cell, total, r, c, grid_path))
            print(f"Created {filename}")

def main():
    args = parse_args()
    cell, total = compute_dimensions(args.width, args.height, args.max_size, args.min_size)
    grid_path = build_grid_path(args.width, args.height, cell)
    write_icons(args.width, args.height, cell, total, grid_path)

if __name__ == '__main__':
    main()
