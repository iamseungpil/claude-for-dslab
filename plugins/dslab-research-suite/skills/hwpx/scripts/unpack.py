#!/usr/bin/env python3
"""
HWPX Unpack Script
Extracts HWPX file contents and pretty-prints XML files.
"""

import argparse
import zipfile
import os
import sys
from xml.dom import minidom


def pretty_print_xml(xml_content: bytes) -> str:
    """Pretty print XML content with proper indentation."""
    try:
        dom = minidom.parseString(xml_content)
        # Remove extra whitespace and reformat
        pretty = dom.toprettyxml(indent="  ", encoding="utf-8")
        # Remove the XML declaration line that minidom adds (we'll keep original)
        lines = pretty.decode('utf-8').split('\n')
        # Skip empty lines at the start after declaration
        result_lines = []
        skip_empty = True
        for i, line in enumerate(lines):
            if i == 0 and line.startswith('<?xml'):
                result_lines.append(line)
                continue
            if skip_empty and not line.strip():
                continue
            skip_empty = False
            result_lines.append(line)
        return '\n'.join(result_lines)
    except Exception as e:
        # If parsing fails, return original content
        return xml_content.decode('utf-8', errors='replace')


def unpack_hwpx(hwpx_path: str, output_dir: str, pretty: bool = True) -> None:
    """
    Unpack a HWPX file to the specified directory.

    Args:
        hwpx_path: Path to the HWPX file
        output_dir: Directory to extract contents to
        pretty: Whether to pretty-print XML files
    """
    if not os.path.exists(hwpx_path):
        print(f"Error: File not found: {hwpx_path}", file=sys.stderr)
        sys.exit(1)

    if not zipfile.is_zipfile(hwpx_path):
        print(f"Error: Not a valid HWPX/ZIP file: {hwpx_path}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    with zipfile.ZipFile(hwpx_path, 'r') as zf:
        for member in zf.namelist():
            # Read the content
            content = zf.read(member)

            # Create output path
            out_path = os.path.join(output_dir, member)
            os.makedirs(os.path.dirname(out_path), exist_ok=True)

            # Pretty print XML files if requested
            if pretty and member.endswith('.xml'):
                content = pretty_print_xml(content).encode('utf-8')

            # Write the content
            with open(out_path, 'wb') as f:
                f.write(content)

            print(f"Extracted: {member}")

    print(f"\nSuccessfully unpacked to: {output_dir}")
    print(f"Total files: {len(zf.namelist())}")


def main():
    parser = argparse.ArgumentParser(
        description="Unpack HWPX file for editing",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python unpack.py document.hwpx unpacked/
  python unpack.py document.hwpx unpacked/ --no-pretty
        """
    )
    parser.add_argument("hwpx_file", help="Path to the HWPX file")
    parser.add_argument("output_dir", help="Directory to extract contents to")
    parser.add_argument("--no-pretty", action="store_true",
                        help="Don't pretty-print XML files")

    args = parser.parse_args()
    unpack_hwpx(args.hwpx_file, args.output_dir, pretty=not args.no_pretty)


if __name__ == "__main__":
    main()
