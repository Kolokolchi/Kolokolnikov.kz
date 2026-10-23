# Home hero and roaming cat

Mode: Experience. Target: `public/index.html`, `.wild-home` hero and the page companion.

## Accepted direction

The user requested a Dogstudio-style interactive 3D focal object adapted to the existing KK identity and approved one volumetric mark built from the four original logo contours. Later feedback requires the colored portion to stay connected, with only gentle layer movement. Preserve the existing Russian copy, serif/italic display voice, charcoal surface, and blue/lime/orange color roles.

The desktop composition pairs left-aligned editorial copy with the large sculpture on the right. Mobile places the sculpture above the copy. Materials have real thickness, bevels, reflective metal faces and darker sides. Lighting cycles through the three existing palettes on the same object. Pointer response is small and damped; scroll reframing is restrained.

The user also requested one recognizable large-eyed graphite cat with random poses and pawprints. Peeking, lounging and paired head/tail poses may occur at the same element in different orientations. The paired head and tail emerge from opposite edges of that element, clipped behind it. An occasional full-body glide may cross verified empty side whitespace. During scrolling the cat hides before pawprints appear; the short route leads to its exact next head position. Finish the route, fade and remove all prints, then reveal the same planned pose. Keep copy and controls readable.

## Quality bar

- Geometry follows the four paths in `scripts/brand.mjs`; the colored contours retain their connection throughout the cycle.
- The focal object is actual solid 3D geometry, with a readable silhouette and material depth.
- All existing content and controls remain usable on desktop and mobile.
- Cat and visible pawprints never overlap in time. At most three prints form one continuous short trail to the exact future cat destination, with no added edge line. After stopping, finish the route, fade and remove the prints, then reveal the cat behind that same element edge.
- Every pose uses the shared vector face. Paws stay fixed on the edge while the head may tilt. Both endpoints share one axis and are recomputed from the live anchor's side and fractional position, including during retreat, resizing and reduced-motion scroll. Perspective-rotated cards are excluded from rectangular masking.
- Cat placement uses a safe real element edge. If the current viewport has no safe edge, defer showing it rather than cover content.
- User pause, reduced motion, hidden-tab and offscreen states stop nonessential scene animation. Reduced motion retains a static sculpture and cat.

## Implementation

`src/hero-scene.js` is bundled locally with Three.js by `scripts/build-hero.mjs` into `public/hero-scene.js`. `public/wild.js` owns visibility and motion preference policy. `public/scroll-cat.js` and `scroll-cat.css` own the independent companion. Existing SVG assets supply the non-WebGL fallback.
