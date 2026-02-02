#!/usr/bin/env python3
"""
HWPX Pack Script
Creates HWPX file from unpacked directory with proper structure.
"""

import argparse
import zipfile
import os
import sys
from xml.dom import minidom


def condense_xml(xml_content: bytes) -> bytes:
    """Remove unnecessary whitespace from XML while preserving structure."""
    try:
        dom = minidom.parseString(xml_content)
        # Use single-line output (no extra whitespace)
        result = dom.toxml(encoding="utf-8")
        return result
    except Exception:
        return xml_content


def pack_hwpx(input_dir: str, output_path: str, condense: bool = True) -> None:
    """
    Pack a directory into a HWPX file.

    Args:
        input_dir: Directory containing unpacked HWPX contents
        output_path: Path for the output HWPX file
        condense: Whether to condense XML files (remove pretty-printing)
    """
    if not os.path.isdir(input_dir):
        print(f"Error: Directory not found: {input_dir}", file=sys.stderr)
        sys.exit(1)

    # Check for required files
    mimetype_path = os.path.join(input_dir, "mimetype")
    if not os.path.exists(mimetype_path):
        print(f"Error: Missing required file: mimetype", file=sys.stderr)
        sys.exit(1)

    # Collect all files
    files_to_pack = []
    for root, dirs, files in os.walk(input_dir):
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, input_dir)
            files_to_pack.append((full_path, rel_path))

    # Create the HWPX file
    # IMPORTANT: mimetype must be first and stored uncompressed
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Add mimetype first (uncompressed, as per ODF/OWPML spec)
        zf.write(mimetype_path, "mimetype", compress_type=zipfile.ZIP_STORED)

        # Add all other files
        for full_path, rel_path in files_to_pack:
            if rel_path == "mimetype":
                continue  # Already added

            # Read content
            with open(full_path, 'rb') as f:
                content = f.read()

            # Condense XML files if requested
            if condense and rel_path.endswith('.xml'):
                content = condense_xml(content)

            # Write to zip
            zf.writestr(rel_path, content, compress_type=zipfile.ZIP_DEFLATED)
            print(f"Packed: {rel_path}")

    print(f"\nSuccessfully created: {output_path}")
    print(f"Total files: {len(files_to_pack)}")


def main():
    parser = argparse.ArgumentParser(
        description="Pack directory into HWPX file",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python pack.py unpacked/ output.hwpx
  python pack.py unpacked/ output.hwpx --no-condense
        """
    )
    parser.add_argument("input_dir", help="Directory containing unpacked HWPX contents")
    parser.add_argument("output_path", help="Path for the output HWPX file")
    parser.add_argument("--no-condense", action="store_true",
                        help="Don't condense XML files")

    args = parser.parse_args()
    pack_hwpx(args.input_dir, args.output_path, condense=not args.no_condense)


if __name__ == "__main__":
    main()
