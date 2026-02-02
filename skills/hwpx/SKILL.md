---
name: hwpx
description: "Comprehensive HWPX (Korean Hancom Office) document creation, editing, and analysis. When Claude needs to work with Korean word processor documents (.hwpx files) for: (1) Reading and extracting content, (2) Creating new documents, (3) Modifying or editing content, (4) Extracting tables to CSV, (5) Modifying tables or table cells, or any other HWPX document tasks. MANDATORY TRIGGERS: hwpx, hwp, 한글, 한컴, Hancom, Korean document"
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
- **For single edits: Use Edit tool** - Shows exact replacement, avoids unintended matches
- **For bulk operations: Use BeautifulSoup** - Safe XML parsing for removing/modifying multiple elements
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

## Adding Images

Images in HWPX require 3 steps: file placement, manifest registration, and XML element creation.

### Step 1: Place Image File

Copy image to `BinData/` folder:
```
unpacked/BinData/image1.png
```

### Step 2: Register in Manifest

Add entry to `Contents/content.hpf`:
```xml
<opf:item id="image1" href="BinData/image1.png" media-type="image/png" isEmbeded="1"/>
```

### Step 3: Add Image Element

Insert `<hp:pic>` inside `<hp:run>`:

```xml
<hp:p id="0" paraPrIDRef="0" styleIDRef="0">
  <hp:run charPrIDRef="0">
    <hp:pic id="UNIQUE_ID" zOrder="0" numberingType="PICTURE"
            textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0">
      <hp:offset x="0" y="0"/>
      <hp:orgSz width="171600" height="38280"/>  <!-- Original size in EMU -->
      <hp:curSz width="48862" height="10891"/>   <!-- Display size -->
      <hp:flip horizontal="0" vertical="0"/>
      <hp:rotationInfo angle="0" centerX="24431" centerY="5445" rotateimage="1"/>
      <hc:img binaryItemIDRef="image1" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>
      <hp:sz width="48862" widthRelTo="ABSOLUTE" height="10891" heightRelTo="ABSOLUTE" protect="0"/>
      <hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0"
              vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT"
              vertOffset="0" horzOffset="0"/>
      <hp:outMargin left="0" right="0" top="0" bottom="0"/>
    </hp:pic>
    <hp:t/>
  </hp:run>
</hp:p>
```

### Image Positioning Types

| Type | `treatAsChar` | `textWrap` | Description |
|------|---------------|------------|-------------|
| 글자처럼 취급 | `1` | any | Inline with text, moves with text flow |
| 자유 배치 | `0` | `TOP_AND_BOTTOM` | Text flows above/below image |
| 글 앞으로 | `0` | `IN_FRONT_OF_TEXT` | Image overlays text |
| 글 뒤로 | `0` | `BEHIND_TEXT` | Text overlays image |
| 사각형 | `0` | `SQUARE` | Text wraps around bounding box |

### Size Units

- **EMU** (English Metric Units): 914400 EMU = 1 inch
- **HWP Units**: Approximately 100 units = 1mm

### Common Pitfall: Copying Images Between Documents

When copying images from one HWPX to another:
1. Copy `BinData/imageX.png` files
2. Add manifest entries to `content.hpf`
3. Copy or recreate `<hp:pic>` elements in section XML
4. Ensure `binaryItemIDRef` matches the manifest `id`

---

## Tables

### Table Structure

Tables in HWPX use the `<hp:tbl>` element:

```xml
<hp:tbl id="1234" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM"
        textFlow="BOTH_SIDES" lock="0" pageBreak="CELL" repeatHeader="1"
        rowCnt="2" colCnt="3" cellSpacing="0" borderFillIDRef="3" noAdjust="0">
  <hp:sz width="50741" widthRelTo="ABSOLUTE" height="8358" heightRelTo="ABSOLUTE" protect="0"/>
  <hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0"
          vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT"
          vertOffset="0" horzOffset="0"/>
  <hp:outMargin left="141" right="141" top="141" bottom="141"/>
  <hp:inMargin left="510" right="510" top="141" bottom="141"/>
  <hp:tr>
    <hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="5">
      <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER">
        <hp:p id="0" paraPrIDRef="20" styleIDRef="0">
          <hp:run charPrIDRef="19">
            <hp:t>Cell content</hp:t>
          </hp:run>
        </hp:p>
      </hp:subList>
      <hp:cellAddr colAddr="0" rowAddr="0"/>
      <hp:cellSpan colSpan="1" rowSpan="1"/>
      <hp:cellSz width="5136" height="4179"/>
      <hp:cellMargin left="510" right="510" top="141" bottom="141"/>
    </hp:tc>
  </hp:tr>
</hp:tbl>
```

### Key Table Attributes

| Attribute | Description |
|-----------|-------------|
| `rowCnt`, `colCnt` | Number of rows and columns |
| `borderFillIDRef` | Reference to border/fill style in header.xml |
| `treatAsChar` | `1` = inline with text, `0` = floating |
| `horzAlign` | Table alignment: LEFT, CENTER, RIGHT |

### Modifying Table Cells

To modify a specific cell:
1. Find the cell by `<hp:cellAddr colAddr="X" rowAddr="Y"/>`
2. Replace the content in `<hp:run>` within that cell's `<hp:subList>`
3. Remove `<hp:linesegarray>` from modified paragraphs

### Removing Tables

Use BeautifulSoup for safe table removal (preserves XML structure):

```python
from bs4 import BeautifulSoup

with open('section0.xml', 'r', encoding='utf-8') as f:
    soup = BeautifulSoup(f.read(), 'xml')

for tbl in soup.find_all('hp:tbl'):
    text = tbl.get_text()
    if "제출 시 삭제" in text or "작성 요령" in text:
        tbl.decompose()

with open('section0.xml', 'w', encoding='utf-8') as f:
    f.write(str(soup))
```

**CRITICAL**: Always use BeautifulSoup for bulk operations. Regex-based removal corrupts XML structure.

---

## Border and Fill Styling

### borderFillIDRef

Tables and cells reference border/fill styles defined in `header.xml`:

```xml
<!-- In header.xml -->
<hh:borderFills itemCnt="10">
  <hh:borderFill id="3" threeD="0" shadow="0" centerLine="NONE">
    <hh:leftBorder type="SOLID" width="0.12 mm" color="#000000"/>
    <hh:rightBorder type="SOLID" width="0.12 mm" color="#000000"/>
    <hh:topBorder type="SOLID" width="0.12 mm" color="#000000"/>
    <hh:bottomBorder type="SOLID" width="0.12 mm" color="#000000"/>
    <hh:fillBrush>
      <hh:winBrush faceColor="#FFFFFF" hatchColor="#000000" alpha="0"/>
    </hh:fillBrush>
  </hh:borderFill>
</hh:borderFills>
```

**Border types**: NONE, SOLID, DASHED, DOTTED, DASH_DOT, etc.

---

## Hyperlinks

Hyperlinks in HWPX use `<hp:fieldBegin>` and `<hp:fieldEnd>`:

```xml
<hp:run charPrIDRef="X">
  <hp:fieldBegin id="123" type="HYPERLINK" name="" editable="0" dirty="1">
    <hp:stringParam name="Category">HWPHYPERLINK_TYPE_URL</hp:stringParam>
    <hp:stringParam name="Target">https://example.com</hp:stringParam>
    <hp:stringParam name="TargetType">HWPHYPERLINK_TARGET_BOOKMARK</hp:stringParam>
  </hp:fieldBegin>
</hp:run>
<hp:run charPrIDRef="X">
  <hp:t>Link text</hp:t>
</hp:run>
<hp:run charPrIDRef="X">
  <hp:fieldEnd type="HYPERLINK"/>
</hp:run>
```

---

## Headers and Footers (머리말/꼬리말)

Page headers and footers in HWPX are controlled through section properties in section0.xml.

### Page Margins for Headers/Footers

```xml
<hp:secPr ...>
  <hp:pagePr landscape="WIDELY" width="59528" height="84188" gutterType="LEFT_ONLY">
    <hp:margin header="4251" footer="4251" gutter="0" left="4251" right="4251" top="2834" bottom="2834"/>
  </hp:pagePr>
</hp:secPr>
```

- `header` and `footer` values set the margin space reserved for header/footer content
- Values are in HWP units (approximately 100 units = 1mm)

### Visibility Settings

```xml
<hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0"
               border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0"/>
```

- `hideFirstHeader="1"` - Hide header on first page
- `hideFirstFooter="1"` - Hide footer on first page

### Page Hiding

```xml
<hp:pageHiding hideHeader="0" hideFooter="0" hideMasterPage="0" hideBorder="0" hideFill="0" hidePageNum="1"/>
```

- `hideHeader="1"` - Hide header for specific section
- `hideFooter="1"` - Hide footer for specific section
- `hidePageNum="1"` - Hide page number

### Page Number Position

```xml
<hp:pageNum pos="BOTTOM_CENTER" formatType="DIGIT" sideChar="-"/>
```

**Position options**: `TOP_LEFT`, `TOP_CENTER`, `TOP_RIGHT`, `BOTTOM_LEFT`, `BOTTOM_CENTER`, `BOTTOM_RIGHT`

**Format types**: `DIGIT` (1, 2, 3), `CIRCLED_DIGIT` (①, ②, ③), `ROMAN_CAPITAL` (I, II, III), `ROMAN_SMALL` (i, ii, iii)

---

## Lists and Numbering (개요/글머리 기호)

### Numbering Definitions

List numbering is defined in `<hh:numberings>` in header.xml:

```xml
<hh:numberings itemCnt="1">
  <hh:numbering id="1" start="0">
    <hh:paraHead start="1" level="1" align="LEFT" useInstWidth="1" autoIndent="1"
                 numFormat="DIGIT" charPrIDRef="4294967295">^1.</hh:paraHead>
    <hh:paraHead start="1" level="2" align="LEFT" useInstWidth="1" autoIndent="1"
                 numFormat="HANGUL_SYLLABLE" charPrIDRef="4294967295">^2.</hh:paraHead>
    <hh:paraHead start="1" level="3" align="LEFT" useInstWidth="1" autoIndent="1"
                 numFormat="DIGIT" charPrIDRef="4294967295">^3)</hh:paraHead>
  </hh:numbering>
</hh:numberings>
```

### paraHead Attributes

| Attribute | Description |
|-----------|-------------|
| `level` | Indentation level (1-10) |
| `numFormat` | Number format (see below) |
| `start` | Starting number |
| `align` | Alignment (LEFT, CENTER, RIGHT) |
| `autoIndent` | Auto-indent (0 or 1) |

### Number Formats (numFormat)

| Format | Example | Description |
|--------|---------|-------------|
| `DIGIT` | 1, 2, 3 | Arabic numerals |
| `HANGUL_SYLLABLE` | 가, 나, 다 | Korean syllables |
| `CIRCLED_DIGIT` | ①, ②, ③ | Circled numbers |
| `ROMAN_CAPITAL` | I, II, III | Roman uppercase |
| `ROMAN_SMALL` | i, ii, iii | Roman lowercase |
| `LATIN_CAPITAL` | A, B, C | Latin uppercase |
| `LATIN_SMALL` | a, b, c | Latin lowercase |

### Format String Placeholders

The text content of `<hh:paraHead>` uses `^N` as placeholder:
- `^1.` → "1.", "2.", "3."
- `(^2)` → "(가)", "(나)", "(다)"
- `^3)` → "1)", "2)", "3)"

### Applying Lists to Paragraphs

Apply list formatting through paraPr's `<hh:heading>`:

```xml
<hh:paraPr id="8" ...>
  <hh:heading type="OUTLINE" idRef="0" level="1"/>
  <hh:margin>
    <hc:left value="1000" unit="HWPUNIT"/>  <!-- List indentation -->
  </hh:margin>
</hh:paraPr>
```

- `type="OUTLINE"` - Use numbering format
- `type="NONE"` - No list formatting
- `idRef` - References numbering definition in `<hh:numberings>`
- `level` - Which level of numbering to use (1-10)

### Using Lists in Content

Reference the paraPr with list formatting:

```xml
<hp:p paraPrIDRef="8" styleIDRef="0">
  <hp:run charPrIDRef="0">
    <hp:t>First item content</hp:t>
  </hp:run>
</hp:p>
```

**CRITICAL**: Unlike DOCX, HWPX numbering is tied to paraPr definitions. To create lists:
1. Find or create a paraPr with `<hh:heading type="OUTLINE" level="X">`
2. Use that paraPrIDRef in your paragraphs

---

## Page Breaks

Page breaks are controlled by the `pageBreak` attribute on `<hp:p>`:

```xml
<!-- pageBreak="1" inserts a page break before this paragraph -->
<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="1" columnBreak="0" merged="0">
  <hp:run charPrIDRef="0">
    <hp:t>This starts on a new page</hp:t>
  </hp:run>
</hp:p>
```

**Values**:
- `pageBreak="0"` - No page break (default)
- `pageBreak="1"` - Page break before this paragraph

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

### 4. Multiple Paragraphs in Table Cell

**Symptom**: Need to add multiple paragraphs to a single cell.

**Solution**: Each paragraph requires its own `<hp:p>` element within the same `<hp:subList>`:

```xml
<hp:subList ...>
  <hp:p id="0" paraPrIDRef="40" styleIDRef="0" ...>
    <hp:run charPrIDRef="49">
      <hp:t>First paragraph content</hp:t>
    </hp:run>
  </hp:p>
  <hp:p id="0" paraPrIDRef="40" styleIDRef="0" ...>
    <hp:run charPrIDRef="49">
      <hp:t>Second paragraph content</hp:t>
    </hp:run>
  </hp:p>
</hp:subList>
```

**Note**: Remove linesegarray from all modified paragraphs.

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

## Paragraph Formatting

### Font Selection

Fonts in HWPX are controlled by `charPrIDRef` in `<hp:run>` elements. The ID references `<hh:charPr>` in header.xml, which contains `<hh:fontRef>` specifying font IDs for each language.

**Finding the correct charPrIDRef:**

1. Search header.xml for `<hh:fontRef hangul="X"` where X is the font ID
2. Note the parent `<hh:charPr id="Y">` - this Y is your charPrIDRef

**Common font mappings (check your document's header.xml):**

| Font Name | Typical hangul ID | Note |
|-----------|-------------------|------|
| 휴먼명조 | 7 | Common body text font |
| HY헤드라인M | 8 | Common heading font |
| 맑은 고딕 | 2 | Modern sans-serif |
| 한컴바탕 | 4 | Traditional serif |

**Example:**
```xml
<!-- Change font by updating charPrIDRef -->
<hp:run charPrIDRef="17">  <!-- charPr 17 uses 휴먼명조 -->
  <hp:t>본문 텍스트</hp:t>
</hp:run>
```

### First-Line Indentation (들여쓰기)

First-line indentation is controlled by `<hc:intent>` inside `<hh:paraPr>` in header.xml.

**Structure in header.xml:**
```xml
<hh:paraPr id="0" ...>
  <hp:switch>
    <hp:case ...>
      <hh:margin>
        <hc:intent value="500" unit="HWPUNIT"/>  <!-- Positive = indent -->
        ...
      </hh:margin>
    </hp:case>
  </hp:switch>
</hh:paraPr>
```

**Values:**
- `value="0"` - No indentation
- `value="500"` - Typical first-line indent (~5mm)
- `value="850"` - Standard Korean body text indent (~8.5mm)
- Negative values create hanging indent (내어쓰기)

**Using existing paraPrIDRef:**
1. Search header.xml for `<hc:intent value=` with non-zero value
2. Note the parent `<hh:paraPr id="Y">` - this Y is your paraPrIDRef
3. Use `<hp:p paraPrIDRef="Y">` in section0.xml

**Creating new paraPr with indentation:**

If no existing paraPr has the desired indentation, create a new one in header.xml:

1. Find `<hh:paraPrs itemCnt="X">` in header.xml
2. Copy an existing `<hh:paraPr>` as template
3. Change the `id` to a new unique number
4. Add or modify `<hc:intent>` inside `<hh:margin>`:

```xml
<hh:paraPr id="81" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1"
           suppressLineNumbers="0" checked="0">
  <hh:align horizontal="JUSTIFY" vertical="BASELINE"/>
  <hh:heading type="NONE" idRef="0" level="0"/>
  <hp:switch requiredNamespace="...">
    <hp:case requiredNamespace="...">
      <hh:margin>
        <hc:intent value="850" unit="HWPUNIT"/>
        <hc:left value="0" unit="HWPUNIT"/>
        <hc:right value="0" unit="HWPUNIT"/>
        <hc:prev value="0" unit="HWPUNIT"/>
        <hc:next value="0" unit="HWPUNIT"/>
      </hh:margin>
    </hp:case>
  </hp:switch>
  <hh:lineSpacing type="PERCENT" value="160"/>
  <hh:border borderFillIDRef="1" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/>
  <hh:autoSpacing eAsianEng="0" eAsianNum="0"/>
</hh:paraPr>
```

5. Update `itemCnt` in `<hh:paraPrs>` to include the new entry
6. Use the new paraPrIDRef in your paragraphs: `<hp:p paraPrIDRef="81">`

**CRITICAL**: Some templates may not have any paraPr with indentation by default. Always verify by searching for `<hc:intent` before assuming one exists

### Image Alignment

Image alignment is controlled by `horzAlign` in `<hp:pos>`:

```xml
<hp:pos treatAsChar="1" ... horzAlign="CENTER" .../>
```

**Alignment options:**
- `LEFT` - Left aligned (default)
- `CENTER` - Center aligned
- `RIGHT` - Right aligned

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
