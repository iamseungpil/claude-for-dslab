# HWPX XML Reference

Detailed XML structures for advanced HWPX editing.

## Table of Contents

- [Namespaces](#namespaces)
- [Paragraph Structure](#paragraph-structure)
- [Table Cell Structure](#table-cell-structure)
- [Headers and Footers](#headers-and-footers)
- [Lists and Numbering](#lists-and-numbering)
- [Paragraph Formatting](#paragraph-formatting)
- [header.xml Reference](#headerxml-reference)

---

## Namespaces

| Prefix | Purpose |
|--------|---------|
| `hp` | Paragraphs, runs, text |
| `hs` | Sections |
| `hh` | Header definitions |
| `hc` | Common elements |

---

## Paragraph Structure

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

**Key attributes:**
- `paraPrIDRef` - References paragraph properties in header.xml
- `charPrIDRef` - References character properties (font, size) in header.xml
- `<hp:linesegarray>` - Layout cache (MUST remove when editing text)

---

## Table Cell Structure

**CRITICAL: `<hp:cellAddr>` appears AFTER cell content.**

```xml
<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="5">
  <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER">
    <hp:p id="0" paraPrIDRef="20" styleIDRef="0">
      <hp:run charPrIDRef="19">
        <hp:t>Cell content</hp:t>
      </hp:run>
    </hp:p>
  </hp:subList>
  <hp:cellAddr colAddr="0" rowAddr="0"/>  <!-- AFTER content -->
  <hp:cellSpan colSpan="1" rowSpan="1"/>
  <hp:cellSz width="5136" height="4179"/>
</hp:tc>
```

### Multiple Paragraphs in Cell

```xml
<hp:subList ...>
  <hp:p id="0" paraPrIDRef="40" styleIDRef="0" ...>
    <hp:run charPrIDRef="49">
      <hp:t>First paragraph</hp:t>
    </hp:run>
  </hp:p>
  <hp:p id="0" paraPrIDRef="40" styleIDRef="0" ...>
    <hp:run charPrIDRef="49">
      <hp:t>Second paragraph</hp:t>
    </hp:run>
  </hp:p>
</hp:subList>
```

---

## Headers and Footers

Page headers/footers are controlled through section properties in section0.xml.

### Page Margins

```xml
<hp:secPr ...>
  <hp:pagePr landscape="WIDELY" width="59528" height="84188" gutterType="LEFT_ONLY">
    <hp:margin header="4251" footer="4251" gutter="0" left="4251" right="4251" top="2834" bottom="2834"/>
  </hp:pagePr>
</hp:secPr>
```

Values are in HWP units (~100 units = 1mm).

### Visibility Settings

```xml
<hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0"
               border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0"/>
```

### Page Hiding

```xml
<hp:pageHiding hideHeader="0" hideFooter="0" hideMasterPage="0" hideBorder="0" hideFill="0" hidePageNum="1"/>
```

### Page Number

```xml
<hp:pageNum pos="BOTTOM_CENTER" formatType="DIGIT" sideChar="-"/>
```

**Position options**: `TOP_LEFT`, `TOP_CENTER`, `TOP_RIGHT`, `BOTTOM_LEFT`, `BOTTOM_CENTER`, `BOTTOM_RIGHT`

**Format types**: `DIGIT` (1,2,3), `CIRCLED_DIGIT` (①②③), `ROMAN_CAPITAL` (I,II,III), `ROMAN_SMALL` (i,ii,iii)

---

## Lists and Numbering

### Numbering Definitions (header.xml)

```xml
<hh:numberings itemCnt="1">
  <hh:numbering id="1" start="0">
    <hh:paraHead start="1" level="1" align="LEFT" useInstWidth="1" autoIndent="1"
                 numFormat="DIGIT" charPrIDRef="4294967295">^1.</hh:paraHead>
    <hh:paraHead start="1" level="2" align="LEFT" useInstWidth="1" autoIndent="1"
                 numFormat="HANGUL_SYLLABLE" charPrIDRef="4294967295">^2.</hh:paraHead>
  </hh:numbering>
</hh:numberings>
```

### Number Formats

| Format | Example | Description |
|--------|---------|-------------|
| `DIGIT` | 1, 2, 3 | Arabic numerals |
| `HANGUL_SYLLABLE` | 가, 나, 다 | Korean syllables |
| `CIRCLED_DIGIT` | ①, ②, ③ | Circled numbers |
| `ROMAN_CAPITAL` | I, II, III | Roman uppercase |
| `LATIN_CAPITAL` | A, B, C | Latin uppercase |

### Format String Placeholders

- `^1.` → "1.", "2.", "3."
- `(^2)` → "(가)", "(나)", "(다)"

### Applying Lists to Paragraphs

```xml
<hh:paraPr id="8" ...>
  <hh:heading type="OUTLINE" idRef="0" level="1"/>
  <hh:margin>
    <hc:left value="1000" unit="HWPUNIT"/>
  </hh:margin>
</hh:paraPr>
```

Then use: `<hp:p paraPrIDRef="8" ...>`

---

## Paragraph Formatting

### Font Selection

Fonts are controlled by `charPrIDRef` referencing `<hh:charPr>` in header.xml.

**Finding charPrIDRef:**
1. Search header.xml for `<hh:fontRef hangul="X">`
2. Note parent `<hh:charPr id="Y">` - Y is your charPrIDRef

**Common fonts:**
| Font | Typical hangul ID |
|------|-------------------|
| 휴먼명조 | 7 |
| HY헤드라인M | 8 |
| 맑은 고딕 | 2 |

### First-Line Indentation

```xml
<hh:paraPr id="0" ...>
  <hp:switch>
    <hp:case ...>
      <hh:margin>
        <hc:intent value="850" unit="HWPUNIT"/>  <!-- ~8.5mm -->
      </hh:margin>
    </hp:case>
  </hp:switch>
</hh:paraPr>
```

**Values:**
- `value="0"` - No indentation
- `value="500"` - ~5mm indent
- `value="850"` - Standard Korean body text (~8.5mm)
- Negative values = hanging indent (내어쓰기)

### Creating New paraPr with Indentation

1. Find `<hh:paraPrs itemCnt="X">` in header.xml
2. Copy existing `<hh:paraPr>` as template
3. Change `id` to new unique number
4. Add/modify `<hc:intent>` inside `<hh:margin>`
5. Update `itemCnt` in `<hh:paraPrs>`
6. Use: `<hp:p paraPrIDRef="NEW_ID">`

### Image Alignment

```xml
<hp:pos treatAsChar="1" ... horzAlign="CENTER" .../>
```

Options: `LEFT`, `CENTER`, `RIGHT`

---

## header.xml Reference

### paraPr Structure

```xml
<hh:paraPr id="0" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1">
  <hh:align horizontal="JUSTIFY" vertical="BASELINE"/>
  <hh:heading type="NONE" idRef="0" level="0"/>
  <hp:switch requiredNamespace="...">
    <hp:case requiredNamespace="...">
      <hh:margin>
        <hc:intent value="0" unit="HWPUNIT"/>
        <hc:left value="0" unit="HWPUNIT"/>
        <hc:right value="0" unit="HWPUNIT"/>
      </hh:margin>
    </hp:case>
  </hp:switch>
  <hh:lineSpacing type="PERCENT" value="160"/>
</hh:paraPr>
```

### charPr Structure

```xml
<hh:charPr id="0" height="1000" textColor="0" shadeColor="4294967295" useFontSpace="0"
           useKerning="0" symMark="NONE" borderFillIDRef="1">
  <hh:fontRef hangul="2" latin="2" hanja="2" japanese="2" other="2" symbol="2" user="2"/>
  <hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
</hh:charPr>
```

### Font Definitions

```xml
<hh:fontfaces itemCnt="7">
  <hh:fontface lang="HANGUL" fontCnt="2">
    <hh:font id="0" face="한컴바탕" type="TTF" isEmbedded="0"/>
    <hh:font id="1" face="맑은 고딕" type="TTF" isEmbedded="0"/>
    <hh:font id="7" face="휴먼명조" type="TTF" isEmbedded="0"/>
  </hh:fontface>
</hh:fontfaces>
```
