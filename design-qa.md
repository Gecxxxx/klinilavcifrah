# Design QA — portraits and Timur role

## Visual truth

- Source screenshots:
  - `../upload/ce0bd083-deb0-4cfc-8083-fc63e289a807.png` — marketing Hero, 1907 × 896 px.
  - `../upload/08270228-9af1-4743-a8bb-3c2a0de72ba8.png` — digital Hero, 1907 × 943 px.
  - `../upload/64023042-5f4b-4520-8047-4c3e321a9e52.png` — commercial-system Hero, 1907 × 1021 px.
  - `../upload/e80de100-7b50-4bd2-8c6b-0970a36583df.png` — team cards, 1907 × 788 px.
- Browser-rendered implementation screenshots:
  - `design-qa/screenshots/marketing-hero-after.jpg`
  - `design-qa/screenshots/digital-hero-after.jpg`
  - `design-qa/screenshots/system-hero-after.jpg`
  - `design-qa/screenshots/team-after.jpg`
- Same-input comparisons:
  - `design-qa/comparisons/digital-before-after.jpg`
  - `design-qa/comparisons/team-before-after.jpg`
- Cloud-browser CSS viewport: 1363 × 936 px, DPR 1.
- Saved implementation screenshots: 1348 × 926 px.
- State: desktop, routes opened after image loading, menu closed, scroll position at the relevant Hero/team section.
- Density normalization: comparison inputs were normalized to 760 px height without changing aspect ratio. Browser chrome and the Windows taskbar in the supplied sources were excluded from visual findings.

## Full-view comparison evidence

- Digital Hero: the supplied source showed a narrow portrait with large black side fields. The revised portrait fills its rounded frame, preserves the original face, and keeps a chest-up composition.
- Marketing and commercial-system Heroes: both portraits fill the same visual frame treatment without exposed container gaps; scale and facial position are consistent with the digital Hero.
- Team section: all three media regions are rendered at 407 × 407 CSS px in the checked viewport. Each source is a dedicated 960 × 960 WebP, so no card uses `contain` or displays empty side boundaries.

## Focused region evidence

- The portrait regions are large and fully readable in the full-view comparisons, so separate close-up crops were not required.
- DOM image checks confirmed all three team assets loaded successfully, each with equal natural width and height and equal rendered width and height.
- The rendered copy and image alt text both use `Проджект-менеджер` for Timur.

## Required fidelity surfaces

- Fonts and typography: existing Roboto Condensed family, weights, wrapping, hierarchy, and text scale were preserved. Only Timur's requested role copy changed.
- Spacing and layout rhythm: the existing Hero and card grids were preserved. Portrait fill behavior changed without moving the copy, CTAs, orbit icons, or card text.
- Colors and visual tokens: existing dark, cyan, pink, violet, lime, and orange tokens remain unchanged.
- Image quality and asset fidelity: original supplied portraits were retained. Dedicated 960 × 960 WebP crops were produced for team cards; no faces were regenerated, stretched, or replaced.
- Copy and content: `Продукт менеджер` was replaced in both central data locations with the exact requested `Проджект-менеджер`.

## Interaction and browser checks

- Desktop navigation to `/komanda` was clicked and completed successfully.
- All three team images completed loading and rendered as 407 × 407 px squares.
- Marketing, digital, commercial-system, and team routes were opened in the cloud browser.
- Application console errors across the checked routes: 0. A browser-extension metadata error was excluded because it is outside the application.

## Comparison history

1. Initial evidence identified P1 empty side fields in Egor's Hero caused by `object-fit: contain`, plus P2 inconsistent non-square team photography and the outdated Timur role.
2. Hero portraits were unified on `cover` with per-person focal positioning. Dedicated square WebP files replaced runtime card cropping, and Timur's role was updated centrally.
3. Post-fix browser evidence confirmed filled Hero frames, equal square team media, preserved faces, successful image loads, working navigation, and no application console errors.

## Findings

- P0: 0
- P1: 0
- P2: 0
- P3: 0

final result: passed
