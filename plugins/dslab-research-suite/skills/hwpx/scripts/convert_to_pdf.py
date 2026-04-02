#!/usr/bin/env python3
"""
Convert HWPX/HWP files to PDF format using LibreOffice.

Usage:
    python convert_to_pdf.py input.hwpx [output.pdf]
    python convert_to_pdf.py input.hwpx -o output_dir/

If output is not specified, creates input.pdf in the same directory.
"""

import argparse
import sys
from pathlib import Path

# Add parent directory to path for office.soffice import
sys.path.insert(0, str(Path(__file__).parent))

from office.soffice import run_soffice


def convert_to_pdf(input_path: str, output_path: str = None) -> str:
    """Convert HWPX/HWP file to PDF format.

    Args:
        input_path: Path to input .hwpx or .hwp file
        output_path: Optional output path or directory

    Returns:
        Path to the created PDF file
    """
    input_file = Path(input_path).resolve()

    if not input_file.exists():
        raise FileNotFoundError(f"Input file not found: {input_file}")

    if input_file.suffix.lower() not in ['.hwpx', '.hwp']:
        raise ValueError(f"Input file must be .hwpx or .hwp format: {input_file}")

    # Determine output location
    if output_path:
        output = Path(output_path)
        if output.is_dir() or str(output_path).endswith('/'):
            output.mkdir(parents=True, exist_ok=True)
            output_dir = output
        else:
            output_dir = output.parent
            output_dir.mkdir(parents=True, exist_ok=True)
    else:
        output_dir = input_file.parent

    # Run LibreOffice conversion
    result = run_soffice([
        '--headless',
        '--convert-to', 'pdf',
        '--outdir', str(output_dir),
        str(input_file)
    ], capture_output=True, text=True)

    if result.returncode != 0:
        raise RuntimeError(f"Conversion failed: {result.stderr}")

    # Find the output file
    expected_output = output_dir / f"{input_file.stem}.pdf"

    if not expected_output.exists():
        raise RuntimeError(f"Conversion completed but output file not found: {expected_output}")

    # Rename if specific output path was given
    if output_path and not Path(output_path).is_dir() and not str(output_path).endswith('/'):
        final_output = Path(output_path)
        expected_output.rename(final_output)
        return str(final_output)

    return str(expected_output)


def main():
    parser = argparse.ArgumentParser(
        description='Convert HWPX/HWP files to PDF format'
    )
    parser.add_argument('input', help='Input .hwpx or .hwp file')
    parser.add_argument('output', nargs='?', help='Output .pdf file or directory')
    parser.add_argument('-o', '--outdir', help='Output directory')

    args = parser.parse_args()

    output = args.output or args.outdir

    try:
        result = convert_to_pdf(args.input, output)
        print(f"Converted: {result}")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
