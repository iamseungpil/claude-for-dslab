#!/usr/bin/env python3
"""
HWPX Table Extraction Script
Extracts tables from HWPX files to CSV format.
"""

import argparse
import zipfile
import csv
import os
import sys
from typing import List, Dict, Any
from bs4 import BeautifulSoup


def extract_cell_text(cell_elem) -> str:
    """Extract text from a table cell."""
    texts = []
    for t_elem in cell_elem.find_all(['t', 'hp:t']):
        if t_elem.string:
            texts.append(t_elem.string.strip())
    return ' '.join(texts)


def extract_tables_from_section(xml_content: bytes) -> List[List[List[str]]]:
    """Extract all tables from a section XML file."""
    soup = BeautifulSoup(xml_content, 'lxml-xml')
    tables = []

    # Find all table elements
    for tbl_elem in soup.find_all(['tbl', 'hp:tbl']):
        table_data = []

        # Find all rows
        for tr_elem in tbl_elem.find_all(['tr', 'hp:tr']):
            row_data = []

            # Find all cells
            for tc_elem in tr_elem.find_all(['tc', 'hp:tc']):
                cell_text = extract_cell_text(tc_elem)
                row_data.append(cell_text)

            if row_data:
                table_data.append(row_data)

        if table_data:
            tables.append(table_data)

    return tables


def extract_tables_from_hwpx(hwpx_path: str, output_dir: str = None,
                              output_prefix: str = "table") -> List[List[List[str]]]:
    """
    Extract all tables from a HWPX file.

    Args:
        hwpx_path: Path to the HWPX file
        output_dir: Directory to save CSV files (if None, prints to stdout)
        output_prefix: Prefix for output CSV files

    Returns:
        List of tables, each table is a list of rows, each row is a list of cells
    """
    if not os.path.exists(hwpx_path):
        print(f"Error: File not found: {hwpx_path}", file=sys.stderr)
        sys.exit(1)

    all_tables = []

    with zipfile.ZipFile(hwpx_path, 'r') as zf:
        # Find all section files
        section_files = sorted([
            name for name in zf.namelist()
            if name.startswith('Contents/section') and name.endswith('.xml')
        ])

        for section_file in section_files:
            content = zf.read(section_file)
            tables = extract_tables_from_section(content)
            all_tables.extend(tables)

    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        for i, table in enumerate(all_tables):
            csv_path = os.path.join(output_dir, f"{output_prefix}_{i+1}.csv")
            with open(csv_path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                for row in table:
                    writer.writerow(row)
            print(f"Saved: {csv_path} ({len(table)} rows)")
    else:
        # Print tables to stdout
        for i, table in enumerate(all_tables):
            print(f"\n=== Table {i+1} ({len(table)} rows) ===")
            for row in table:
                print(" | ".join(row))

    print(f"\nTotal tables extracted: {len(all_tables)}")
    return all_tables


def main():
    parser = argparse.ArgumentParser(
        description="Extract tables from HWPX file to CSV",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python extract_tables.py document.hwpx
  python extract_tables.py document.hwpx -o tables/
  python extract_tables.py document.hwpx -o tables/ --prefix data
        """
    )
    parser.add_argument("hwpx_file", help="Path to the HWPX file")
    parser.add_argument("-o", "--output-dir", help="Directory to save CSV files")
    parser.add_argument("--prefix", default="table",
                        help="Prefix for output CSV files (default: table)")

    args = parser.parse_args()
    extract_tables_from_hwpx(args.hwpx_file, args.output_dir, args.prefix)


if __name__ == "__main__":
    main()
