# HWPX Image Insertion Guide

Safe methods for inserting images into HWPX documents.

## Table of Contents

- [Critical: Complete hp:pic Structure](#critical-complete-hppic-structure)
- [Why String Replacement Fails](#why-string-replacement-fails)
- [Three Required Steps](#three-required-steps)
- [Safe Insertion with lxml](#safe-insertion-with-lxml)
- [Helper Functions](#helper-functions)
- [Complete Python Script](#complete-python-script)
- [Image with Caption](#image-with-caption)

---

## Critical: Complete hp:pic Structure

**IMPORTANT**: The `<hp:pic>` element requires ALL 15 child elements in the correct order. Missing elements cause Hancom Office crashes or images not displaying.

### Required Elements (in order)

| # | Element | Purpose | Common Mistake |
|---|---------|---------|----------------|
| 1 | `hp:offset` | Position offset | - |
| 2 | `hp:orgSz` | Original image size | - |
| 3 | `hp:curSz` | Display size | - |
| 4 | `hp:flip` | Horizontal/vertical flip | - |
| 5 | `hp:rotationInfo` | Rotation settings | - |
| 6 | `hp:renderingInfo` | Transform matrices | Wrong scale values |
| 7 | `hc:img` | Image binary reference | Wrong binaryItemIDRef |
| 8 | `hp:imgRect` | Image boundary rectangle | - |
| 9 | `hp:imgClip` | **Clip region** | **OFTEN MISSING - causes crash** |
| 10 | `hp:inMargin` | Inner margins | - |
| 11 | `hp:imgDim` | **Original dimensions** | **OFTEN MISSING - image not shown** |
| 12 | `hp:effects` | **Effects (can be empty)** | **OFTEN MISSING - causes crash** |
| 13 | `hp:sz` | Display size with relative settings | - |
| 14 | `hp:pos` | Position and alignment | Missing treatAsChar |
| 15 | `hp:outMargin` | Outer margins | - |

### Complete Working Structure

```xml
<hp:pic id="100001" zOrder="0" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM"
        textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href=""
        groupLevel="0" instid="1100001" reverse="0">

  <!-- 1. Position offset -->
  <hp:offset x="0" y="0"/>

  <!-- 2. Original size (pixel x 100) -->
  <hp:orgSz width="99600" height="126700"/>

  <!-- 3. Display size (actual render size) -->
  <hp:curSz width="17000" height="21624"/>

  <!-- 4. Flip settings -->
  <hp:flip horizontal="0" vertical="0"/>

  <!-- 5. Rotation -->
  <hp:rotationInfo angle="0" centerX="0" centerY="0" rotateimage="0"/>

  <!-- 6. Rendering transforms - scale = curSz/orgSz -->
  <hp:renderingInfo>
    <hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>
    <hc:scaMatrix e1="0.170683" e2="0" e3="0" e4="0" e5="0.170671" e6="0"/>
    <hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>
  </hp:renderingInfo>

  <!-- 7. Image reference (must match content.hpf manifest id) -->
  <hc:img binaryItemIDRef="receipt1" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>

  <!-- 8. Image boundary rectangle -->
  <hp:imgRect>
    <hc:pt0 x="0" y="0"/>
    <hc:pt1 x="99600" y="0"/>
    <hc:pt2 x="99600" y="126700"/>
    <hc:pt3 x="0" y="126700"/>
  </hp:imgRect>

  <!-- 9. CRITICAL: Clip region - MUST include -->
  <hp:imgClip left="0" right="99600" top="0" bottom="126700"/>

  <!-- 10. Inner margins -->
  <hp:inMargin left="0" right="0" top="0" bottom="0"/>

  <!-- 11. CRITICAL: Original dimensions - MUST include -->
  <hp:imgDim dimwidth="99600" dimheight="126700"/>

  <!-- 12. CRITICAL: Effects element - MUST include (can be empty) -->
  <hp:effects/>

  <!-- 13. Size with relative settings -->
  <hp:sz width="17000" widthRelTo="ABSOLUTE" height="21624" heightRelTo="ABSOLUTE" protect="0"/>

  <!-- 14. Position - treatAsChar="1" for inline -->
  <hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0"
          holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN"
          vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>

  <!-- 15. Outer margins -->
  <hp:outMargin left="0" right="0" top="0" bottom="0"/>
</hp:pic>
```

### Size Calculation

```python
# Original size: pixel x 100
org_width = pixel_width * 100    # e.g., 996px -> 99600
org_height = pixel_height * 100  # e.g., 1267px -> 126700

# Display size: mm x 283.5 (7200/25.4)
display_width = mm_width * 283.5   # e.g., 60mm -> 17010
display_height = mm_height * 283.5

# Scale matrix: display / original
scale_x = display_width / org_width
scale_y = display_height / org_height
```

### Key Points

1. **hp:pic goes inside hp:run** — not standalone
2. **Empty hp:t after hp:pic** — `<hp:t/>` element is required after the image
3. **hp:linesegarray after hp:run** — layout cache (Hancom regenerates on open)
4. **binaryItemIDRef** — must match the `id` in content.hpf manifest

---

## Why String Replacement Fails

**Problem**: Using regex/string replacement to insert `<hp:pic>` elements often causes XML corruption.

**Symptoms**:
- Hancom Office shows "file is damaged" error or crashes (SIGSEGV)
- `xmllint` reports "tag mismatch" errors
- Tag count imbalance

**Root Cause**: String replacement doesn't understand XML structure:

```python
# WRONG - breaks XML structure
content = content.replace(
    '<hp:t>Target</hp:t>',
    '<hp:t>Target</hp:t></hp:run></hp:p><hp:p>NEW</hp:p><hp:p><hp:run>'
)
```

**Solution**: Always use lxml for structural changes.

---

## Three Required Steps

When inserting images, ALL three steps must be completed:

| Step | Location | What to do |
|------|----------|------------|
| 1. Image file | `BinData/` | Copy image file (e.g., `receipt1.png`) |
| 2. Manifest | `Contents/content.hpf` | Add `<opf:item id="receipt1" href="BinData/receipt1.png" media-type="image/png" isEmbeded="1"/>` |
| 3. XML reference | `Contents/section0.xml` | Insert complete `<hp:pic>` with all 15 elements |

**Common failures**:
- Step 1 missing → Image placeholder shows but no image
- Step 2 missing → Hancom can't find the image file
- Step 3 incomplete → Crash or image not displayed
- `binaryItemIDRef` doesn't match manifest `id` → Image not found

---

## Safe Insertion with lxml

### Complete Python Function

```python
from lxml import etree

NS = {
    'hp': 'http://www.hancom.co.kr/hwpml/2011/paragraph',
    'hc': 'http://www.hancom.co.kr/hwpml/2011/core',
}

def nsmap(prefix, local):
    return f"{{{NS[prefix]}}}{local}"

def create_complete_pic(image_id, bin_ref, org_width, org_height, display_width, display_height):
    """
    Create hp:pic element with ALL 15 required child elements.

    Args:
        image_id: Unique ID for the image
        bin_ref: Reference to binary in manifest (must match content.hpf id)
        org_width, org_height: Original image size (pixel x 100)
        display_width, display_height: Display size in HWP units
    """
    scale_x = display_width / org_width if org_width > 0 else 1
    scale_y = display_height / org_height if org_height > 0 else 1

    pic = etree.Element(nsmap('hp', 'pic'))
    pic.set('id', str(image_id))
    pic.set('zOrder', '0')
    pic.set('numberingType', 'PICTURE')
    pic.set('textWrap', 'TOP_AND_BOTTOM')
    pic.set('textFlow', 'BOTH_SIDES')
    pic.set('lock', '0')
    pic.set('dropcapstyle', 'None')
    pic.set('href', '')
    pic.set('groupLevel', '0')
    pic.set('instid', str(image_id + 1000000))
    pic.set('reverse', '0')

    # 1. hp:offset
    offset = etree.SubElement(pic, nsmap('hp', 'offset'))
    offset.set('x', '0'); offset.set('y', '0')

    # 2. hp:orgSz
    orgSz = etree.SubElement(pic, nsmap('hp', 'orgSz'))
    orgSz.set('width', str(org_width)); orgSz.set('height', str(org_height))

    # 3. hp:curSz
    curSz = etree.SubElement(pic, nsmap('hp', 'curSz'))
    curSz.set('width', str(display_width)); curSz.set('height', str(display_height))

    # 4. hp:flip
    flip = etree.SubElement(pic, nsmap('hp', 'flip'))
    flip.set('horizontal', '0'); flip.set('vertical', '0')

    # 5. hp:rotationInfo
    rotInfo = etree.SubElement(pic, nsmap('hp', 'rotationInfo'))
    rotInfo.set('angle', '0'); rotInfo.set('centerX', '0')
    rotInfo.set('centerY', '0'); rotInfo.set('rotateimage', '0')

    # 6. hp:renderingInfo
    renderInfo = etree.SubElement(pic, nsmap('hp', 'renderingInfo'))
    transMatrix = etree.SubElement(renderInfo, nsmap('hc', 'transMatrix'))
    for a, v in [('e1','1'),('e2','0'),('e3','0'),('e4','0'),('e5','1'),('e6','0')]:
        transMatrix.set(a, v)
    scaMatrix = etree.SubElement(renderInfo, nsmap('hc', 'scaMatrix'))
    scaMatrix.set('e1', f'{scale_x:.6f}'); scaMatrix.set('e2', '0')
    scaMatrix.set('e3', '0'); scaMatrix.set('e4', '0')
    scaMatrix.set('e5', f'{scale_y:.6f}'); scaMatrix.set('e6', '0')
    rotMatrix = etree.SubElement(renderInfo, nsmap('hc', 'rotMatrix'))
    for a, v in [('e1','1'),('e2','0'),('e3','0'),('e4','0'),('e5','1'),('e6','0')]:
        rotMatrix.set(a, v)

    # 7. hc:img
    img = etree.SubElement(pic, nsmap('hc', 'img'))
    img.set('binaryItemIDRef', bin_ref); img.set('bright', '0')
    img.set('contrast', '0'); img.set('effect', 'REAL_PIC'); img.set('alpha', '0')

    # 8. hp:imgRect
    imgRect = etree.SubElement(pic, nsmap('hp', 'imgRect'))
    for name, x, y in [('pt0',0,0), ('pt1',org_width,0),
                       ('pt2',org_width,org_height), ('pt3',0,org_height)]:
        pt = etree.SubElement(imgRect, nsmap('hc', name))
        pt.set('x', str(x)); pt.set('y', str(y))

    # 9. CRITICAL: hp:imgClip
    imgClip = etree.SubElement(pic, nsmap('hp', 'imgClip'))
    imgClip.set('left', '0'); imgClip.set('right', str(org_width))
    imgClip.set('top', '0'); imgClip.set('bottom', str(org_height))

    # 10. hp:inMargin
    inMargin = etree.SubElement(pic, nsmap('hp', 'inMargin'))
    for a in ['left', 'right', 'top', 'bottom']: inMargin.set(a, '0')

    # 11. CRITICAL: hp:imgDim
    imgDim = etree.SubElement(pic, nsmap('hp', 'imgDim'))
    imgDim.set('dimwidth', str(org_width)); imgDim.set('dimheight', str(org_height))

    # 12. CRITICAL: hp:effects (can be empty but MUST exist)
    etree.SubElement(pic, nsmap('hp', 'effects'))

    # 13. hp:sz
    sz = etree.SubElement(pic, nsmap('hp', 'sz'))
    sz.set('width', str(display_width)); sz.set('widthRelTo', 'ABSOLUTE')
    sz.set('height', str(display_height)); sz.set('heightRelTo', 'ABSOLUTE')
    sz.set('protect', '0')

    # 14. hp:pos
    pos = etree.SubElement(pic, nsmap('hp', 'pos'))
    pos.set('treatAsChar', '1'); pos.set('affectLSpacing', '0')
    pos.set('flowWithText', '1'); pos.set('allowOverlap', '0')
    pos.set('holdAnchorAndSO', '0'); pos.set('vertRelTo', 'PARA')
    pos.set('horzRelTo', 'COLUMN'); pos.set('vertAlign', 'TOP')
    pos.set('horzAlign', 'LEFT'); pos.set('vertOffset', '0')
    pos.set('horzOffset', '0')

    # 15. hp:outMargin
    outMargin = etree.SubElement(pic, nsmap('hp', 'outMargin'))
    for a in ['left', 'right', 'top', 'bottom']: outMargin.set(a, '0')

    return pic
```

### Wrapping in Paragraph

```python
def create_image_paragraph(pic_element, para_pr="21", style="0", char_pr="11"):
    """Create hp:p element containing an image"""
    p = etree.Element(nsmap('hp', 'p'))
    p.set('id', '0'); p.set('paraPrIDRef', para_pr)
    p.set('styleIDRef', style); p.set('pageBreak', '0')
    p.set('columnBreak', '0'); p.set('merged', '0')

    run = etree.SubElement(p, nsmap('hp', 'run'))
    run.set('charPrIDRef', char_pr)
    run.append(pic_element)

    # REQUIRED: Empty hp:t after hp:pic
    etree.SubElement(run, nsmap('hp', 't'))

    return p
```

---

## Helper Functions

Utility functions for common image insertion tasks: finding insertion points, copying images between documents, and creating text paragraphs.

```python
import copy

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
    """Copy hp:pic element from source document by binaryItemIDRef"""
    for pic in source_tree.iter('{http://www.hancom.co.kr/hwpml/2011/paragraph}pic'):
        for img in pic.iter('{http://www.hancom.co.kr/hwpml/2011/core}img'):
            if img.get('binaryItemIDRef') == image_ref:
                return copy.deepcopy(pic)
    return None

def find_cell_by_addr(root, col, row):
    """Find table cell by column and row address"""
    for cellAddr in root.iter(nsmap('hp', 'cellAddr')):
        if cellAddr.get('colAddr') == str(col) and cellAddr.get('rowAddr') == str(row):
            return cellAddr.getparent()
    return None

def create_text_paragraph(text, para_pr="39", style="41", char_pr="73"):
    """Create hp:p element with text content"""
    p = etree.Element('{http://www.hancom.co.kr/hwpml/2011/paragraph}p')
    p.set('id', '0'); p.set('paraPrIDRef', para_pr)
    p.set('styleIDRef', style); p.set('pageBreak', '0')
    p.set('columnBreak', '0'); p.set('merged', '0')

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

def insert_images_in_cell(tc, images_info):
    """Insert images into a table cell"""
    sublist = tc.find(nsmap('hp', 'subList'))
    if sublist is None:
        return False

    for p in list(sublist.findall(nsmap('hp', 'p'))):
        sublist.remove(p)

    for i, (bin_ref, org_w, org_h, disp_w, disp_h) in enumerate(images_info):
        p = etree.SubElement(sublist, nsmap('hp', 'p'))
        p.set('id', str(2147483648 + i)); p.set('paraPrIDRef', '21')
        p.set('styleIDRef', '0'); p.set('pageBreak', '0')
        p.set('columnBreak', '0'); p.set('merged', '0')

        run = etree.SubElement(p, nsmap('hp', 'run'))
        run.set('charPrIDRef', '11')

        pic = create_complete_pic(100001 + i, bin_ref, org_w, org_h, disp_w, disp_h)
        run.append(pic)
        etree.SubElement(run, nsmap('hp', 't'))

    return True
```

---

## Complete Python Script

Full working example: insert receipt images into a table cell.

```python
#!/usr/bin/env python3
"""Insert images into HWPX - complete working example"""

import os
import shutil
from lxml import etree

NS = {
    'hp': 'http://www.hancom.co.kr/hwpml/2011/paragraph',
    'hc': 'http://www.hancom.co.kr/hwpml/2011/core',
}

def nsmap(prefix, local):
    return f"{{{NS[prefix]}}}{local}"

# ... (include create_complete_pic, create_image_paragraph,
#      find_cell_by_addr, insert_images_in_cell from above)

def main():
    # 1. Unpack hwpx
    # python scripts/unpack.py document.hwpx unpacked/

    unpacked_dir = 'unpacked'

    # 2. Copy images to BinData/
    os.makedirs(f'{unpacked_dir}/BinData', exist_ok=True)
    shutil.copy('receipt1.png', f'{unpacked_dir}/BinData/')
    shutil.copy('receipt2.png', f'{unpacked_dir}/BinData/')

    # 3. Update manifest (content.hpf)
    # Add: <opf:item id="receipt1" href="BinData/receipt1.png" media-type="image/png" isEmbeded="1"/>

    # 4. Parse and edit section0.xml
    parser = etree.XMLParser(remove_blank_text=False)
    section_path = f'{unpacked_dir}/Contents/section0.xml'
    tree = etree.parse(section_path, parser)
    root = tree.getroot()

    # 5. Find target cell and insert images
    tc = find_cell_by_addr(root, col=0, row=4)
    if tc:
        org_w, org_h = 99600, 126700
        disp_w, disp_h = 17000, 21624

        images = [
            ('receipt1', org_w, org_h, disp_w, disp_h),
            ('receipt2', org_w, org_h, disp_w, disp_h),
        ]
        insert_images_in_cell(tc, images)

    # 6. Save
    tree.write(section_path, encoding='utf-8', xml_declaration=True)

    # 7. Validate
    try:
        etree.parse(section_path, parser)
        print("OK: XML validation passed")
    except etree.XMLSyntaxError as e:
        print(f"ERROR: XML error: {e}")
        return

    # 8. Pack
    # python scripts/pack.py unpacked/ output.hwpx

if __name__ == '__main__':
    main()
```

---

## Image with Caption

Captions are embedded inside `<hp:pic>` using `<hp:caption>`:

```xml
<hp:pic id="1234567" ...>
  <!-- ... all 15 child elements ... -->
  <hp:caption side="BOTTOM" fullSz="0" width="8504" gap="850" lastWidth="51026">
    <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" ...>
      <hp:p id="0" paraPrIDRef="20" styleIDRef="0" ...>
        <hp:run charPrIDRef="77">
          <hp:t>Figure 1: Caption text here</hp:t>
        </hp:run>
      </hp:p>
    </hp:subList>
  </hp:caption>
</hp:pic>
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Hancom crashes (SIGSEGV) | Missing hp:imgClip, hp:imgDim, or hp:effects | Add all 15 child elements |
| Image not displayed | binaryItemIDRef doesn't match manifest id | Ensure id matches exactly |
| Image placeholder only | Image file missing from BinData/ | Copy image file |
| Image too large | Wrong size calculation | Use pixel x 100 for orgSz |
| "File damaged" error | String replacement broke XML | Use lxml for insertion |
