# HWPX Image Insertion Guide

Safe methods for inserting images into HWPX documents.

## Table of Contents

- [Why String Replacement Fails](#why-string-replacement-fails)
- [Correct Image Structure](#correct-image-structure)
- [Safe Insertion with lxml](#safe-insertion-with-lxml)
- [Complete Example Script](#complete-example-script)

---

## Why String Replacement Fails

**Problem**: Using regex/string replacement to insert `<hp:pic>` elements into section0.xml often causes XML corruption.

**Symptoms**:
- Hancom Office shows "file is damaged" error
- `xmllint` reports "tag mismatch" errors
- Tag count imbalance (e.g., more opening than closing tags)

**Root Cause**: String replacement doesn't understand XML structure. Inserting content mid-element breaks parent-child relationships:

```python
# ❌ WRONG - breaks XML structure
content = content.replace(
    '<hp:t>Target text</hp:t>',
    '<hp:t>Target text</hp:t></hp:run></hp:p><hp:p>NEW CONTENT</hp:p><hp:p><hp:run>'
)
```

This creates orphaned closing tags and mismatched elements.

**Solution**: Always use proper XML parsing (lxml) for structural changes.

---

## Correct Image Structure

### Basic Image in Paragraph

```xml
<hp:p id="0" paraPrIDRef="38" styleIDRef="41" pageBreak="0" columnBreak="0" merged="0">
  <hp:run charPrIDRef="0">
    <hp:pic id="1234567" zOrder="5" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" ...>
      <hp:offset x="0" y="0"/>
      <hp:orgSz width="914400" height="457200"/>
      <hp:curSz width="457200" height="228600"/>
      <hp:flip horizontal="0" vertical="0"/>
      <hp:rotationInfo angle="0" centerX="0" centerY="0" rotateimage="0"/>
      <hp:renderingInfo>
        <hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>
        <hc:scaMatrix e1="0.5" e2="0" e3="0" e4="0" e5="0.5" e6="0"/>
        <hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>
      </hp:renderingInfo>
      <hc:img binaryItemIDRef="image1" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>
      <hp:imgRect>
        <hc:pt0 x="0" y="0"/>
        <hc:pt1 x="914400" y="0"/>
        <hc:pt2 x="914400" y="457200"/>
        <hc:pt3 x="0" y="457200"/>
      </hp:imgRect>
      <hp:inMargin left="0" right="0" top="0" bottom="0"/>
      <hp:sz width="457200" widthRelTo="ABSOLUTE" height="228600" heightRelTo="ABSOLUTE" protect="0"/>
      <hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0"
              vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT"/>
      <hp:outMargin left="0" right="0" top="0" bottom="0"/>
    </hp:pic>
    <hp:t/>  <!-- Empty text element REQUIRED after hp:pic -->
  </hp:run>
  <hp:linesegarray>
    <hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000"
                baseline="850" spacing="600" horzpos="0" horzsize="51024" flags="393216"/>
  </hp:linesegarray>
</hp:p>
```

### Key Points

1. **hp:pic goes inside hp:run** - Not standalone
2. **Empty hp:t after hp:pic** - `<hp:t/>` element is required after the image
3. **hp:linesegarray after hp:run** - Layout cache (Hancom regenerates on open)
4. **binaryItemIDRef** - Must match the `id` in content.hpf manifest

### Image with Caption

The caption is embedded inside `<hp:pic>` using `<hp:caption>`:

```xml
<hp:pic id="1234567" ...>
  <!-- ... image attributes ... -->
  <hp:caption side="BOTTOM" fullSz="0" width="8504" gap="850" lastWidth="51026">
    <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" ...>
      <hp:p id="0" paraPrIDRef="20" styleIDRef="0" ...>
        <hp:run charPrIDRef="77">
          <hp:t>&lt;그림 1&gt; Caption text here</hp:t>
        </hp:run>
        <hp:linesegarray>...</hp:linesegarray>
      </hp:p>
    </hp:subList>
  </hp:caption>
</hp:pic>
```

---

## Safe Insertion with lxml

### Basic Pattern

```python
from lxml import etree
import copy

# Namespaces
NS = {
    'hp': 'http://www.hancom.co.kr/hwpml/2011/paragraph',
    'hc': 'http://www.hancom.co.kr/hwpml/2011/core',
    'hs': 'http://www.hancom.co.kr/hwpml/2011/section',
}

# Parse XML
parser = etree.XMLParser(remove_blank_text=False)
tree = etree.parse('section0.xml', parser)
root = tree.getroot()

# Find insertion point
target_p = find_element_containing_text(root, 'Target Section Title')

# Create new paragraph with image
new_p = create_image_paragraph(pic_element)

# Insert after target
parent = target_p.getparent()
idx = list(parent).index(target_p)
parent.insert(idx + 1, new_p)

# Save
tree.write('section0.xml', encoding='utf-8', xml_declaration=True)
```

### Helper Functions

```python
def find_element_containing_text(root, text):
    """Find hp:p element containing specific text in hp:t"""
    for t_elem in root.iter('{http://www.hancom.co.kr/hwpml/2011/paragraph}t'):
        if t_elem.text and text in t_elem.text:
            parent = t_elem.getparent()
            while parent is not None:
                if parent.tag == '{http://www.hancom.co.kr/hwpml/2011/paragraph}p':
                    return parent
                parent = parent.getparent()
    return None

def copy_pic_element(source_tree, image_ref):
    """Copy hp:pic element from source document"""
    for pic in source_tree.iter('{http://www.hancom.co.kr/hwpml/2011/paragraph}pic'):
        for img in pic.iter('{http://www.hancom.co.kr/hwpml/2011/core}img'):
            if img.get('binaryItemIDRef') == image_ref:
                return copy.deepcopy(pic)
    return None

def create_image_paragraph(pic_element, para_pr="38", style="41", char_pr="0"):
    """Create hp:p element containing an image"""
    p = etree.Element('{http://www.hancom.co.kr/hwpml/2011/paragraph}p')
    p.set('id', '0')
    p.set('paraPrIDRef', para_pr)
    p.set('styleIDRef', style)
    p.set('pageBreak', '0')
    p.set('columnBreak', '0')
    p.set('merged', '0')

    run = etree.SubElement(p, '{http://www.hancom.co.kr/hwpml/2011/paragraph}run')
    run.set('charPrIDRef', char_pr)

    run.append(pic_element)

    # Empty text element after image (REQUIRED)
    t = etree.SubElement(run, '{http://www.hancom.co.kr/hwpml/2011/paragraph}t')

    return p

def create_text_paragraph(text, para_pr="39", style="41", char_pr="73"):
    """Create hp:p element with text content"""
    p = etree.Element('{http://www.hancom.co.kr/hwpml/2011/paragraph}p')
    p.set('id', '0')
    p.set('paraPrIDRef', para_pr)
    p.set('styleIDRef', style)
    p.set('pageBreak', '0')
    p.set('columnBreak', '0')
    p.set('merged', '0')

    run = etree.SubElement(p, '{http://www.hancom.co.kr/hwpml/2011/paragraph}run')
    run.set('charPrIDRef', char_pr)

    t = etree.SubElement(run, '{http://www.hancom.co.kr/hwpml/2011/paragraph}t')
    t.text = text

    return p

def insert_after(parent, reference, new_elements):
    """Insert new_elements after reference element"""
    if not isinstance(new_elements, list):
        new_elements = [new_elements]

    idx = list(parent).index(reference)
    for i, elem in enumerate(new_elements):
        parent.insert(idx + 1 + i, elem)
```

---

## Complete Example Script

This script copies images from a source document and inserts them into a target document:

```python
#!/usr/bin/env python3
"""Insert images from source HWPX into target HWPX"""

import shutil
import os
from lxml import etree
import copy

NS = {
    'hp': 'http://www.hancom.co.kr/hwpml/2011/paragraph',
    'hc': 'http://www.hancom.co.kr/hwpml/2011/core',
}

def main():
    # 1. Unpack both documents
    # python scripts/unpack.py source.hwpx source_unpacked/
    # python scripts/unpack.py target.hwpx target_unpacked/

    # 2. Copy image files
    os.makedirs('target_unpacked/BinData', exist_ok=True)
    shutil.copy('source_unpacked/BinData/image1.png', 'target_unpacked/BinData/')

    # 3. Update manifest (content.hpf)
    with open('target_unpacked/Contents/content.hpf', 'r', encoding='utf-8') as f:
        manifest = f.read()

    image_item = '<opf:item id="image1" href="BinData/image1.png" media-type="image/png" isEmbeded="1"/>'
    manifest = manifest.replace('<opf:item id="section0"', image_item + '<opf:item id="section0"')

    with open('target_unpacked/Contents/content.hpf', 'w', encoding='utf-8') as f:
        f.write(manifest)

    # 4. Parse XML files
    parser = etree.XMLParser(remove_blank_text=False)
    source_tree = etree.parse('source_unpacked/Contents/section0.xml', parser)
    target_tree = etree.parse('target_unpacked/Contents/section0.xml', parser)
    target_root = target_tree.getroot()

    # 5. Copy hp:pic element from source
    pic_element = None
    for pic in source_tree.iter('{http://www.hancom.co.kr/hwpml/2011/paragraph}pic'):
        for img in pic.iter('{http://www.hancom.co.kr/hwpml/2011/core}img'):
            if img.get('binaryItemIDRef') == 'image1':
                pic_element = copy.deepcopy(pic)
                break

    if pic_element is None:
        print("Error: Could not find image element in source")
        return

    # 6. Find insertion point in target
    target_p = None
    for t_elem in target_root.iter('{http://www.hancom.co.kr/hwpml/2011/paragraph}t'):
        if t_elem.text and 'INSERT_IMAGE_HERE' in t_elem.text:
            parent = t_elem.getparent()
            while parent is not None:
                if parent.tag == '{http://www.hancom.co.kr/hwpml/2011/paragraph}p':
                    target_p = parent
                    break
                parent = parent.getparent()

    if target_p is None:
        print("Error: Could not find insertion point")
        return

    # 7. Create image paragraph
    img_p = etree.Element('{http://www.hancom.co.kr/hwpml/2011/paragraph}p')
    img_p.set('id', '0')
    img_p.set('paraPrIDRef', '38')
    img_p.set('styleIDRef', '41')
    img_p.set('pageBreak', '0')
    img_p.set('columnBreak', '0')
    img_p.set('merged', '0')

    run = etree.SubElement(img_p, '{http://www.hancom.co.kr/hwpml/2011/paragraph}run')
    run.set('charPrIDRef', '0')
    run.append(pic_element)
    etree.SubElement(run, '{http://www.hancom.co.kr/hwpml/2011/paragraph}t')

    # 8. Insert after target
    parent = target_p.getparent()
    idx = list(parent).index(target_p)
    parent.insert(idx + 1, img_p)

    # 9. Save and validate
    target_tree.write('target_unpacked/Contents/section0.xml',
                      encoding='utf-8', xml_declaration=True)

    # Validate
    try:
        etree.parse('target_unpacked/Contents/section0.xml', parser)
        print("XML validation passed")
    except etree.XMLSyntaxError as e:
        print(f"XML validation failed: {e}")
        return

    # 10. Repack
    # python scripts/pack.py target_unpacked/ output.hwpx
    print("Done! Run pack.py to create final HWPX")

if __name__ == '__main__':
    main()
```

---

## Three Required Steps Checklist

When inserting images, ALL three steps must be completed:

| Step | Location | What to do |
|------|----------|------------|
| 1. Image file | `BinData/` | Copy image file (e.g., `image1.png`) |
| 2. Manifest | `Contents/content.hpf` | Add `<opf:item id="image1" href="BinData/image1.png" .../>` |
| 3. XML reference | `Contents/section0.xml` | Insert `<hp:pic>` with `<hc:img binaryItemIDRef="image1"/>` |

**Common failures**:
- Step 1 missing → Image placeholder shows but no image
- Step 2 missing → Hancom can't find the image file
- Step 3 missing → No image appears at all
- `binaryItemIDRef` doesn't match manifest `id` → Image not found
