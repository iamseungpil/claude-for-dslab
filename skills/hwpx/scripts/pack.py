#!/usr/bin/env python3
"""
HWPX Pack Script
Creates HWPX file from unpacked directory with proper structure.
Automatically validates before packing to catch issues early.
"""

import argparse
import zipfile
import os
import sys
from pathlib import Path
from xml.dom import minidom

# Add parent directory to path for validate import
sys.path.insert(0, str(Path(__file__).parent))

from validate import validate_hwpx


def condense_xml(xml_content: bytes) -> bytes:
    """Remove unnecessary whitespace from XML while preserving structure."""
    try:
        dom = minidom.parseString(xml_content)
        # Use single-line output (no extra whitespace)
        result = dom.toxml(encoding="utf-8")
        return result
    except Exception:
        return xml_content


def pack_hwpx(input_dir: str, output_path: str, condense: bool = True,
              skip_validation: bool = False, force: bool = False) -> bool:
    """
    Pack a directory into a HWPX file.

    Args:
        input_dir: Directory containing unpacked HWPX contents
        output_path: Path for the output HWPX file
        condense: Whether to condense XML files (remove pretty-printing)
        skip_validation: Skip validation step
        force: Pack even if validation fails

    Returns:
        True if successful, False otherwise
    """
    if not os.path.isdir(input_dir):
        print(f"Error: Directory not found: {input_dir}", file=sys.stderr)
        return False

    # Check for required files
    mimetype_path = os.path.join(input_dir, "mimetype")
    if not os.path.exists(mimetype_path):
        print(f"Error: Missing required file: mimetype", file=sys.stderr)
        return False

    # Run validation
    if not skip_validation:
        print("Validating HWPX structure...")
        report = validate_hwpx(input_dir)
        report.print_report()
        print()

        if not report.is_valid:
            if not force:
                print("Validation failed. Use --force to pack anyway.", file=sys.stderr)
                return False
            else:
                print("Warning: Packing despite validation errors (--force).", file=sys.stderr)

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
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Pack directory into HWPX file with validation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python pack.py unpacked/ output.hwpx
  python pack.py unpacked/ output.hwpx --no-condense
  python pack.py unpacked/ output.hwpx --skip-validation
  python pack.py unpacked/ output.hwpx --force  # Pack even with errors
        """
    )
    parser.add_argument("input_dir", help="Directory containing unpacked HWPX contents")
    parser.add_argument("output_path", help="Path for the output HWPX file")
    parser.add_argument("--no-condense", action="store_true",
                        help="Don't condense XML files")
    parser.add_argument("--skip-validation", action="store_true",
                        help="Skip validation step")
    parser.add_argument("--force", "-f", action="store_true",
                        help="Pack even if validation fails")

    args = parser.parse_args()
    success = pack_hwpx(
        args.input_dir,
        args.output_path,
        condense=not args.no_condense,
        skip_validation=args.skip_validation,
        force=args.force
    )
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
