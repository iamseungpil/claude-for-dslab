#!/usr/bin/env python3
"""
Validate HWPX files for common issues before they cause problems in Hancom Office.

Usage:
    python validate.py document.hwpx
    python validate.py unpacked_dir/

Checks:
    1. XML well-formedness (all XML files parse correctly)
    2. Tag balance (hp:p, hp:run, hp:tbl, hp:tc, hp:tr, hp:subList)
    3. Manifest consistency (content.hpf vs actual BinData files)
    4. Image reference validation (binaryItemIDRef matches manifest id)
    5. Linesegarray warnings (stale layout cache detection)
"""

import argparse
import os
import re
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import List, Tuple, Dict, Optional
from dataclasses import dataclass, field

try:
    from lxml import etree
    HAS_LXML = True
except ImportError:
    HAS_LXML = False

try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False


@dataclass
class ValidationResult:
    """Result of a validation check."""
    level: str  # "ERROR", "WARNING", "INFO"
    check: str  # Name of the check
    message: str
    file: str = ""
    line: int = 0

    def __str__(self):
        loc = f" ({self.file}:{self.line})" if self.file else ""
        return f"[{self.level}] {self.check}{loc}: {self.message}"


@dataclass
class ValidationReport:
    """Complete validation report."""
    results: List[ValidationResult] = field(default_factory=list)

    def add(self, level: str, check: str, message: str, file: str = "", line: int = 0):
        self.results.append(ValidationResult(level, check, message, file, line))

    def error(self, check: str, message: str, file: str = "", line: int = 0):
        self.add("ERROR", check, message, file, line)

    def warning(self, check: str, message: str, file: str = "", line: int = 0):
        self.add("WARNING", check, message, file, line)

    def info(self, check: str, message: str, file: str = "", line: int = 0):
        self.add("INFO", check, message, file, line)

    @property
    def errors(self) -> List[ValidationResult]:
        return [r for r in self.results if r.level == "ERROR"]

    @property
    def warnings(self) -> List[ValidationResult]:
        return [r for r in self.results if r.level == "WARNING"]

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0

    def print_report(self):
        if not self.results:
            print("✓ All checks passed")
            return

        for result in self.results:
            if result.level == "ERROR":
                print(f"✗ {result}")
            elif result.level == "WARNING":
                print(f"⚠ {result}")
            else:
                print(f"ℹ {result}")

        print()
        print(f"Summary: {len(self.errors)} errors, {len(self.warnings)} warnings")
        if self.is_valid:
            print("✓ File is valid (warnings may still cause display issues)")
        else:
            print("✗ File has errors and may not open correctly")


class HWPXValidator:
    """Validator for HWPX files."""

    # Tags that must be balanced
    BALANCED_TAGS = ['hp:p', 'hp:run', 'hp:tbl', 'hp:tc', 'hp:tr', 'hp:subList', 'hp:sec']

    # HWPX namespaces
    NAMESPACES = {
        'hp': 'http://www.hancom.co.kr/hwpml/2011/paragraph',
        'hh': 'http://www.hancom.co.kr/hwpml/2011/head',
        'hc': 'http://www.hancom.co.kr/hwpml/2011/core',
        'hs': 'http://www.hancom.co.kr/hwpml/2011/section',
        'opf': 'http://www.idpf.org/2007/opf',
    }

    def __init__(self, path: str):
        self.path = Path(path)
        self.report = ValidationReport()
        self.work_dir: Optional[Path] = None
        self._temp_dir = None

    def validate(self) -> ValidationReport:
        """Run all validation checks."""
        # Unpack if needed
        if self.path.is_file() and self.path.suffix.lower() == '.hwpx':
            self._temp_dir = tempfile.mkdtemp()
            self.work_dir = Path(self._temp_dir)
            try:
                with zipfile.ZipFile(self.path, 'r') as zf:
                    zf.extractall(self.work_dir)
            except zipfile.BadZipFile as e:
                self.report.error("ZIP", f"Invalid ZIP file: {e}")
                return self.report
        elif self.path.is_dir():
            self.work_dir = self.path
        else:
            self.report.error("INPUT", f"Not a valid HWPX file or directory: {self.path}")
            return self.report

        # Run checks
        self._check_required_files()
        self._check_xml_wellformedness()
        self._check_tag_balance()
        self._check_manifest_consistency()
        self._check_image_references()
        self._check_linesegarray_issues()

        # Cleanup
        if self._temp_dir:
            import shutil
            shutil.rmtree(self._temp_dir, ignore_errors=True)

        return self.report

    def _check_required_files(self):
        """Check that required files exist."""
        required = [
            'mimetype',
            'Contents/header.xml',
            'Contents/content.hpf',
        ]

        for filepath in required:
            full_path = self.work_dir / filepath
            if not full_path.exists():
                self.report.error("REQUIRED_FILE", f"Missing required file: {filepath}")

        # Check for at least one section file
        section_files = list((self.work_dir / 'Contents').glob('section*.xml'))
        if not section_files:
            self.report.error("REQUIRED_FILE", "No section*.xml files found in Contents/")

    def _check_xml_wellformedness(self):
        """Check that all XML files are well-formed."""
        xml_files = list(self.work_dir.rglob('*.xml')) + list(self.work_dir.rglob('*.hpf'))

        for xml_file in xml_files:
            rel_path = xml_file.relative_to(self.work_dir)
            try:
                if HAS_LXML:
                    parser = etree.XMLParser()
                    etree.parse(str(xml_file), parser)
                else:
                    # Fallback: try to parse with built-in xml
                    import xml.etree.ElementTree as ET
                    ET.parse(xml_file)

            except Exception as e:
                error_msg = str(e)
                # Try to extract line number
                line_match = re.search(r'line (\d+)', error_msg)
                line_num = int(line_match.group(1)) if line_match else 0
                self.report.error("XML_WELLFORMED", error_msg, str(rel_path), line_num)

    def _check_tag_balance(self):
        """Check that important tags are balanced using lxml if available."""
        section_files = list((self.work_dir / 'Contents').glob('section*.xml'))

        for section_file in section_files:
            rel_path = section_file.relative_to(self.work_dir)

            # Use lxml for accurate tag counting if available
            if HAS_LXML:
                try:
                    tree = etree.parse(str(section_file))
                    # If it parses, tags are balanced
                    continue
                except etree.XMLSyntaxError as e:
                    # Extract specific error info
                    self.report.error(
                        "TAG_BALANCE",
                        f"XML syntax error: {e}",
                        str(rel_path),
                        e.lineno if hasattr(e, 'lineno') else 0
                    )
                    continue

            # Fallback to regex-based check (less accurate)
            content = section_file.read_text(encoding='utf-8')

            for tag in self.BALANCED_TAGS:
                # More precise patterns
                # Opening tags: <tag> or <tag attr="val">
                open_pattern = f'<{re.escape(tag)}(?:\\s[^>]*)?>(?!</)'
                # Closing tags: </tag>
                close_pattern = f'</{re.escape(tag)}>'
                # Self-closing: <tag/> or <tag attr="val"/>
                self_closing_pattern = f'<{re.escape(tag)}(?:\\s[^>]*)?/>'

                # Find all matches
                opens = len(re.findall(open_pattern, content))
                closes = len(re.findall(close_pattern, content))
                self_closes = len(re.findall(self_closing_pattern, content))

                # Non-self-closing opens should equal closes
                non_self_opens = opens
                if non_self_opens != closes:
                    self.report.error(
                        "TAG_BALANCE",
                        f"Tag <{tag}> may be unbalanced: {non_self_opens} opening, {closes} closing (regex check, may have false positives)",
                        str(rel_path)
                    )

    def _check_manifest_consistency(self):
        """Check that manifest (content.hpf) matches actual files."""
        manifest_path = self.work_dir / 'Contents' / 'content.hpf'
        if not manifest_path.exists():
            return  # Already reported in required files check

        try:
            if HAS_LXML:
                tree = etree.parse(str(manifest_path))
                root = tree.getroot()
                items = root.findall('.//{http://www.idpf.org/2007/opf}item')
            else:
                if HAS_BS4:
                    content = manifest_path.read_text(encoding='utf-8')
                    soup = BeautifulSoup(content, 'xml')
                    items = soup.find_all('item')
                else:
                    return  # Can't check without lxml or bs4

            # Check each item in manifest
            for item in items:
                if HAS_LXML:
                    href = item.get('href')
                    item_id = item.get('id')
                else:
                    href = item.get('href')
                    item_id = item.get('id')

                if href and href.startswith('BinData/'):
                    file_path = self.work_dir / 'Contents' / href
                    if not file_path.exists():
                        # Also check without Contents prefix
                        file_path = self.work_dir / href
                        if not file_path.exists():
                            self.report.error(
                                "MANIFEST",
                                f"Manifest references missing file: {href} (id={item_id})"
                            )

            # Check for files not in manifest
            bindata_dir = self.work_dir / 'BinData'
            if bindata_dir.exists():
                manifest_hrefs = set()
                for item in items:
                    href = item.get('href') if HAS_LXML else item.get('href')
                    if href:
                        manifest_hrefs.add(href.replace('BinData/', ''))

                for file in bindata_dir.iterdir():
                    if file.name not in manifest_hrefs:
                        self.report.warning(
                            "MANIFEST",
                            f"File not in manifest: BinData/{file.name}"
                        )

        except Exception as e:
            self.report.error("MANIFEST", f"Failed to parse manifest: {e}")

    def _check_image_references(self):
        """Check that image references in XML match manifest."""
        manifest_path = self.work_dir / 'Contents' / 'content.hpf'
        if not manifest_path.exists():
            return

        # Get all IDs from manifest
        manifest_ids = set()
        try:
            content = manifest_path.read_text(encoding='utf-8')
            # Simple regex to extract ids
            for match in re.finditer(r'<[^>]*\bid="([^"]+)"', content):
                manifest_ids.add(match.group(1))
        except Exception:
            return

        # Check section files for binaryItemIDRef
        section_files = list((self.work_dir / 'Contents').glob('section*.xml'))
        for section_file in section_files:
            rel_path = section_file.relative_to(self.work_dir)
            content = section_file.read_text(encoding='utf-8')

            for match in re.finditer(r'binaryItemIDRef="([^"]+)"', content):
                ref_id = match.group(1)
                if ref_id not in manifest_ids:
                    self.report.error(
                        "IMAGE_REF",
                        f"binaryItemIDRef=\"{ref_id}\" not found in manifest",
                        str(rel_path)
                    )

    def _check_linesegarray_issues(self):
        """Warn about potential linesegarray issues."""
        section_files = list((self.work_dir / 'Contents').glob('section*.xml'))

        for section_file in section_files:
            rel_path = section_file.relative_to(self.work_dir)
            content = section_file.read_text(encoding='utf-8')

            # Find paragraphs with both text content and linesegarray
            # This is informational - not necessarily an error
            lineseg_count = len(re.findall(r'<hp:linesegarray>', content))
            if lineseg_count > 0:
                self.report.info(
                    "LINESEGARRAY",
                    f"Found {lineseg_count} linesegarray elements. "
                    "If text was edited, these may cause character overlap.",
                    str(rel_path)
                )


def validate_hwpx(path: str) -> ValidationReport:
    """Validate an HWPX file or unpacked directory.

    Args:
        path: Path to .hwpx file or unpacked directory

    Returns:
        ValidationReport with all findings
    """
    validator = HWPXValidator(path)
    return validator.validate()


def main():
    parser = argparse.ArgumentParser(
        description='Validate HWPX files for common issues'
    )
    parser.add_argument('path', help='HWPX file or unpacked directory to validate')
    parser.add_argument('-q', '--quiet', action='store_true',
                       help='Only show errors, not warnings')

    args = parser.parse_args()

    report = validate_hwpx(args.path)

    if args.quiet:
        for result in report.errors:
            print(f"✗ {result}")
        if report.errors:
            print(f"\n{len(report.errors)} errors found")
    else:
        report.print_report()

    sys.exit(0 if report.is_valid else 1)


if __name__ == '__main__':
    main()
