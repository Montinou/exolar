# Open Graph / Social Preview Image

## Purpose
Image shown when sharing links on Twitter/X, LinkedIn, Slack, Discord, and other platforms. This is often the first visual impression for potential users—it must stop the scroll, communicate value instantly, and look premium alongside other content in social feeds. The most "marketing" asset in the set.

## Technical Specifications
- **Dimensions**: 1200 x 630 px (standard OG ratio)
- **Background**: Solid #0D0F14 (Deep Void) - note: some platforms may add their own borders
- **Format**: PNG (for transparency after background removal)
- **Style**: Cinematic, atmospheric, professional SaaS, scroll-stopping

## Image Generation Prompt

```
A cinematic horizontal composition on a solid dark background color #0D0F14. The layout follows rule-of-thirds with the main content in the center-left.

In the upper-left quadrant, the MCP Dashboard logo: three elegant curved indigo #6366F1 lines spiraling toward a glowing amber #E5A832 sphere, with a thin white arc crossing through. To its right, "MCP Dashboard" text in clean white #FFFFFF sans-serif typography.

Below the logo, centered in the composition, the tagline "Test Results, Ready for the AI Age" in light gray #E5E7EB text, elegant and readable.

The right side and bottom of the image feature atmospheric brand elements: scattered soft particles in indigo #6366F1 and violet #7C3AED drifting across the space, a subtle gradient glow of amber emanating from the logo's core and fading into the background, and 3-4 thin curved lines suggesting orbital data paths fading from indigo to transparent as they extend toward the edges.

In the bottom-right area, very subtle and semi-transparent, abstract UI elements suggesting a dashboard: faint rectangular card shapes with rounded corners, a hint of a line chart silhouette, small status dots—all rendered at 10-15% opacity in indigo, just barely visible, implying the product without showing actual interface.

Safe zones: keep all text and critical elements away from the outer 60px on all sides (social platforms crop differently). The composition is dynamic but balanced, professional but visually interesting. The solid #0D0F14 background anchors everything with no gradients in the base background itself.
```

## Style Notes
- **Hierarchy**: Logo → Tagline → Atmospheric elements → Subtle UI hints
- **Scroll-Stopping**: The glowing amber core should draw the eye immediately
- **Professional Confidence**: Premium SaaS aesthetic, not startup-scrappy
- **Product Hint**: The ghost UI elements suggest "this is a dashboard" without showing screenshots
- **Space for Context**: Design assumes text overlay from social platforms (link titles, descriptions)

## What to Avoid
- No actual product screenshots (dates quickly, hard to read at social preview size)
- No busy backgrounds or competing focal points
- No clip art or stock imagery
- No multiple CTAs or excessive text
- No elements in the danger zones (outer 60px margins)

## Consistency Reference
This image brings together all brand elements: the logo from Asset 01, the atmospheric particles from Asset 04 (placeholder), the color system used throughout. It's the "hero shot" of the brand identity—everything working together at full expression. The subtle UI hints connect directly to the actual product dashboard without creating a screenshot dependency.

## Platform Testing Notes
After generating, verify appearance on:
1. **Twitter/X** - 2:1 crop (1200x600 visible)
2. **LinkedIn** - 1.91:1 crop (1200x628 visible)
3. **Slack** - Often displays smaller, check logo legibility
4. **Discord** - Dark mode context, ensure contrast
5. **iMessage** - May add rounded corners, check edge content
