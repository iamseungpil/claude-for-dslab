---
name: hwpx
description: "Comprehensive HWPX (Korean Hancom Office) document creation, editing, and analysis. When Claude needs to work with Korean word processor documents (.hwpx files) for: (1) Reading and extracting content, (2) Creating new documents, (3) Modifying or editing content, (4) Extracting tables to CSV, or any other HWPX document tasks. MANDATORY TRIGGERS: hwpx, hwp, 한글, 한컴, Hancom, Korean document"
license: MIT
---

# HWPX creation, editing, and analysis

## Overview

A .hwpx file is a ZIP archive containing XML files, based on the OWPML (Open Word-Processor Markup Language) standard (KS X 6101).

## Quick Reference

| Task | Approach |
|------|----------|
| Read/analyze content | `extract_text.py` or unpack for raw XML |
| Extract tables | `extract_tables.py` to export to CSV |
| Create new document | `create_blank.py` |
| Edit existing document | Unpack → edit XML with Edit tool → repack |

### File Structure

```
document.hwpx (ZIP archive)
├── mimetype                    # application/hwp+zip
├── version.xml                 # Version info
├── settings.xml                # Application settings
├── META-INF/                   # Container metadata
├── Contents/
│   ├── header.xml              # Fonts, styles, properties
│   ├── section0.xml            # Body content
│   └── ...
├── BinData/                    # Images and binaries
└── Preview/                    # Thumbnails
```

---

## Critical Rules for HWPX

These rules prevent common corruption and display issues:

- **Always remove `<hp:linesegarray>` when changing text** - This contains layout cache; mismatched values cause character overlap
- **Use Edit tool directly, never Python regex** - Regex matches unintended locations; Edit tool shows exact replacement
- **Find cells by `<hp:cellAddr>` not content** - cellAddr appears AFTER content; include it in search string for uniqueness
- **Preserve `charPrIDRef` attributes** - References font/style in header.xml; changing breaks formatting
- **Empty runs are self-closing** - `<hp:run charPrIDRef="X"/>` vs filled `<hp:run charPrIDRef="X"><hp:t>text</hp:t></hp:run>`
- **Multiple runs share one linesegarray** - Remove entire linesegarray when editing any run in paragraph

---

## Reading Content

```bash
# Text extraction
python scripts/extract_text.py document.hwpx
python scripts/extract_text.py document.hwpx -o output.txt

# Table extraction to CSV
python scripts/extract_tables.py document.hwpx -o tables/

# Raw XML access
python scripts/unpack.py document.hwpx unpacked/
```

---

## Creating New Documents

```bash
python scripts/create_blank.py output.hwpx
python scripts/create_blank.py output.hwpx --title "My Document" --text "Content"
```

---

## Editing Existing Documents

**Follow all 3 steps in order.**

### Step 1: Unpack

```bash
python scripts/unpack.py document.hwpx unpacked/
```

### Step 2: Edit XML

Edit files in `unpacked/Contents/`. **Use the Edit tool directly.**

**CRITICAL: When modifying text, remove `<hp:linesegarray>` from the same `<hp:p>` element.** Hancom recalculates layout on open. Leaving stale linesegarray causes character overlap.

### Step 3: Pack

```bash
python scripts/pack.py unpacked/ output.hwpx
```

---

## Common Pitfalls

### 1. Character Overlap After Edit

**Symptom**: Text displays garbled, characters overlap.

**Cause**: `<hp:linesegarray>` contains cached layout (horzsize, textpos) that doesn't match new text length.

**Solution**: Remove linesegarray entirely:

```xml
<!-- Before: text with linesegarray -->
<hp:p ...>
  <hp:run charPrIDRef="19">
    <hp:t>Short text</hp:t>
  </hp:run>
  <hp:linesegarray>
    <hp:lineseg textpos="0" ... horzsize="5000" .../>
  </hp:linesegarray>
</hp:p>

<!-- After: remove linesegarray when text changes -->
<hp:p ...>
  <hp:run charPrIDRef="19">
    <hp:t>Much longer replacement text here</hp:t>
  </hp:run>
</hp:p>
```

### 2. Wrong Cell Modified in Table

**Symptom**: Text appears in wrong table cell or duplicated.

**Cause**: Using regex to find empty `<hp:run/>` tags matches multiple cells.

**Solution**: Include `<hp:cellAddr>` in search pattern for uniqueness:

```bash
# Find cell at column 2, row 0
grep -B20 'colAddr="2" rowAddr="0"' section0.xml
```

Then use Edit tool with string that includes cellAddr:

```xml
<!-- Include cellAddr in old_string for unique match -->
<hp:run charPrIDRef="19"/>
...
<hp:cellAddr colAddr="2" rowAddr="0"/>
```

### 3. Multi-line Text in Cell Overlaps

**Symptom**: Cells with `<hp:lineBreak/>` display incorrectly.

**Cause**: linesegarray has multiple `<hp:lineseg>` entries with textpos offsets for each line.

**Solution**: Remove entire linesegarray when editing multi-line content:

```xml
<!-- Multi-line cell with lineBreak -->
<hp:run charPrIDRef="57">
  <hp:t>Line one<hp:lineBreak/>Line two</hp:t>
</hp:run>
<!-- Remove ALL lineseg entries, not just one -->
```

---

## XML Reference

### Namespaces

| Prefix | Purpose |
|--------|---------|
| `hp` | Paragraphs, runs, text |
| `hs` | Sections |
| `hh` | Header definitions |

### Paragraph Structure

```xml
<hp:p id="0" paraPrIDRef="0" styleIDRef="0">
  <hp:run charPrIDRef="0">
    <hp:t>Text content</hp:t>
  </hp:run>
  <hp:linesegarray>
    <hp:lineseg textpos="0" vertpos="0" vertsize="1000" .../>
  </hp:linesegarray>
</hp:p>
```

### Table Cell Structure

**CRITICAL: `<hp:cellAddr>` appears AFTER cell content, not before.**

```xml
<hp:tc ...>
  <hp:subList ...>
    <hp:p ...>
      <hp:run charPrIDRef="19">
        <hp:t>Cell content</hp:t>
      </hp:run>
      <hp:linesegarray>...</hp:linesegarray>
    </hp:p>
  </hp:subList>
  <hp:cellAddr colAddr="2" rowAddr="0"/>  <!-- AFTER content -->
  <hp:cellSpan colSpan="1" rowSpan="1"/>
  <hp:cellSz width="40915" height="4179"/>
</hp:tc>
```

### Filling Empty Table Cells

```xml
<!-- Before: empty cell -->
<hp:p ...>
  <hp:run charPrIDRef="19"/>  <!-- Self-closing = empty -->
  <hp:linesegarray>...</hp:linesegarray>
</hp:p>
...
<hp:cellAddr colAddr="2" rowAddr="0"/>

<!-- After: filled cell (include cellAddr in search for uniqueness) -->
<hp:p ...>
  <hp:run charPrIDRef="19">
    <hp:t>Your content</hp:t>
  </hp:run>
</hp:p>
...
<hp:cellAddr colAddr="2" rowAddr="0"/>
```

### Line Breaks

Use `<hp:lineBreak/>` inside `<hp:t>` for line breaks within a cell:

```xml
<hp:t>First line<hp:lineBreak/>Second line</hp:t>
```

---

## header.xml Reference

### Font Definitions

```xml
<hh:fontface lang="HANGUL" fontCnt="1">
  <hh:font id="0" face="함초롬돋움" type="TTF"/>
</hh:fontface>
```

### Character Properties

`charPrIDRef` in runs references these:

```xml
<hh:charPr id="0" height="1000" textColor="#000000">
  <hh:fontRef hangul="0" latin="0"/>
</hh:charPr>
```

---

## Differences from DOCX

| Aspect | HWPX | DOCX |
|--------|------|------|
| Text element | `<hp:t>` | `<w:t>` |
| Paragraph | `<hp:p>` | `<w:p>` |
| Run | `<hp:run>` | `<w:r>` |
| Layout cache | `<hp:linesegarray>` | None (recalculated) |
| Content location | `Contents/section*.xml` | `word/document.xml` |
| Cell identifier | `<hp:cellAddr>` after content | implicit order |

**Key difference**: HWPX stores layout cache in linesegarray; DOCX doesn't. This is why editing HWPX requires removing linesegarray.

---

## Dependencies

```bash
pip install beautifulsoup4 lxml --break-system-packages
```

---

## Limitations

- No tracked changes support
- Complex formatting requires header.xml entries
- Image insertion requires binary data registration
