# Home hero and roaming cat

Mode: Experience. Target: `public/index.html`, `.wild-home` hero and the page companion.

## Accepted direction

The user requested a Dogstudio-style interactive 3D focal object adapted to the existing KK identity and approved one volumetric mark built from the four original logo contours. Later feedback requires the colored portion to stay connected, with only gentle layer movement. Preserve the existing Russian copy, serif/italic display voice, charcoal surface, and blue/lime/orange color roles.

The desktop composition pairs left-aligned editorial copy with the large sculpture on the right. Mobile places the sculpture above the copy. Materials have real thickness, bevels, reflective metal faces and darker sides. Lighting cycles through the three existing palettes on the same object. Pointer response is small and damped; scroll reframing is restrained.

The user also requested a small outlined cat and pawprints. The cat rests at actual design-element edges and can change location and orientation. During scrolling it hides before pawprints appear. After scrolling stops, the prints fade and disappear before the cat returns. The companion may appear above, below or beside cards and other elements; it must leave copy and controls readable.

## Quality bar

- Geometry follows the four paths in `scripts/brand.mjs`; the colored contours retain their connection throughout the cycle.
- The focal object is actual solid 3D geometry, with a readable silhouette and material depth.
- All existing content and controls remain usable on desktop and mobile.
- Cat and visible pawprints never overlap in time. At most three prints form one continuous short trail with no added edge line, and stopping the scroll removes them.
- Cat placement uses a safe real element edge. If the current viewport has no safe edge, defer showing it rather than cover content.
- User pause, reduced motion, hidden-tab and offscreen states stop nonessential scene animation. Reduced motion retains a static sculpture and cat.

## Implementation

`src/hero-scene.js` is bundled locally with Three.js by `scripts/build-hero.mjs` into `public/hero-scene.js`. `public/wild.js` owns visibility and motion preference policy. `public/scroll-cat.js` and `scroll-cat.css` own the independent companion. Existing SVG assets supply the non-WebGL fallback.
