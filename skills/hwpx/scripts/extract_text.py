#!/usr/bin/env python3
"""
HWPX Text Extraction Script
Extracts text content from HWPX files.
"""

import argparse
import zipfile
import os
import sys
from typing import List, Optional
from bs4 import BeautifulSoup


# HWPX XML Namespaces
NAMESPACES = {
    'hp': 'http://www.hancom.co.kr/hwpml/2011/paragraph',
    'hp10': 'http://www.hancom.co.kr/hwpml/2016/paragraph',
    'hs': 'http://www.hancom.co.kr/hwpml/2011/section',
    'hc': 'http://www.hancom.co.kr/hwpml/2011/core',
    'hh': 'http://www.hancom.co.kr/hwpml/2011/head',
}


def extract_text_from_section(xml_content: bytes) -> List[str]:
    """Extract text from a section XML file."""
    soup = BeautifulSoup(xml_content, 'lxml-xml')
    texts = []

    # Find all text elements (hp:t)
    for t_elem in soup.find_all(['t', 'hp:t']):
        if t_elem.string:
            text = t_elem.string.strip()
            if text:
                texts.append(text)

    return texts


def extract_text_from_hwpx(hwpx_path: str, output_path: Optional[str] = None,
                           include_empty: bool = False) -> str:
    """
    Extract all text from a HWPX file.

    Args:
        hwpx_path: Path to the HWPX file
        output_path: Optional path to save extracted text
        include_empty: Include empty paragraphs as blank lines

    Returns:
        Extracted text as a string
    """
    if not os.path.exists(hwpx_path):
        print(f"Error: File not found: {hwpx_path}", file=sys.stderr)
        sys.exit(1)

    all_texts = []

    with zipfile.ZipFile(hwpx_path, 'r') as zf:
        # Find all section files
        section_files = sorted([
            name for name in zf.namelist()
            if name.startswith('Contents/section') and name.endswith('.xml')
        ])

        if not section_files:
            print("Warning: No section files found in HWPX", file=sys.stderr)

        for section_file in section_files:
            content = zf.read(section_file)
            texts = extract_text_from_section(content)
            all_texts.extend(texts)

    # Join texts with newlines
    result = '\n'.join(all_texts)

    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(result)
        print(f"Text saved to: {output_path}")

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Extract text from HWPX file",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python extract_text.py document.hwpx
  python extract_text.py document.hwpx -o output.txt
  python extract_text.py document.hwpx --include-empty
        """
    )
    parser.add_argument("hwpx_file", help="Path to the HWPX file")
    parser.add_argument("-o", "--output", help="Output file path")
    parser.add_argument("--include-empty", action="store_true",
                        help="Include empty paragraphs")

    args = parser.parse_args()
    text = extract_text_from_hwpx(args.hwpx_file, args.output, args.include_empty)

    if not args.output:
        print(text)


if __name__ == "__main__":
    main()
