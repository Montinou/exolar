# Favicon

## Purpose
Browser tab icon. Must be crystal clear and instantly recognizable at tiny sizes (16x16 in most browsers). This is often the first visual touchpoint—users see it in their bookmarks, browser tabs alongside competitor products, and pinned tabs. Derived from the main logo but radically simplified for extreme legibility.

## Technical Specifications
- **Dimensions**: 64 x 64 px (will be scaled down to 16x16, 32x32 by browsers)
- **Background**: Solid #0D0F14 (Deep Void) for easy removal
- **Format**: PNG (for transparency after background removal)
- **Style**: Ultra-minimal, bold shapes, maximum contrast

## Image Generation Prompt

```
An extremely simplified geometric icon on a solid dark background color #0D0F14. The design has only two elements: a bold amber #E5A832 circle in the center, perfectly round with crisp edges, taking up approximately 60% of the canvas. Around the amber circle, a single curved arc in electric indigo #6366F1, thick and bold, sweeping around the right side of the circle from roughly 2 o'clock to 7 o'clock position like a partial orbital ring. The indigo arc has consistent thickness and clean terminations. The amber circle is solid with no gradient. Maximum contrast between the bright amber, the indigo arc, and the dark background. No fine details, no additional elements, no white accents at this scale. Designed for extreme reduction—must be recognizable at 16 pixels. Vector-style with perfectly smooth curves and edges. The solid #0D0F14 background is completely flat.
```

## Style Notes
- **Radical Simplification**: Only 2 elements (amber core + indigo arc) vs. full logo's 4+ elements
- **Amber Dominance**: At small sizes, the warm amber is the primary recognition point
- **Single Orbit**: One arc instead of three—complexity that works at 512px fails at 16px
- **No White**: The thin white calibration line from the main logo is too fine for favicon
- **Bold Proportions**: Arc thickness is exaggerated compared to main logo for visibility

## What to Avoid
- No thin lines or delicate details (invisible at 16px)
- No gradients (become muddy at small sizes)
- No multiple colors beyond the two primary (amber + indigo)
- No text or letters
- No transparency effects or glows

## Consistency Reference
This is the "essence" of the main logo distilled to its minimum recognizable form. The amber sphere remains the central identity anchor. The single indigo arc references the full logo's orbital paths without trying to reproduce them. When users see this in a browser tab, they should immediately associate it with the full brand—even if they can't see all the details.

## Size Testing Notes
After generating, verify legibility by:
1. Scaling to 32x32 - both elements should be distinct
2. Scaling to 16x16 - amber circle must be clearly visible, arc provides shape context
3. Comparing against white/light backgrounds (browser tab bars vary)
