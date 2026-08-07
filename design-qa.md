# Design QA

## Visual truth

- Source: `/workspace/scratch/efd8bca3fc24/upload/image(20260807-195036).png`
- Source dimensions: 1672 × 941 px
- Browser-rendered implementation: `design-qa/screenshots/home-1672x941.png`
- Same-input comparison: `design-qa/screenshots/comparison-1672x941.png`
- Comparison viewport: 1672 × 941 CSS px, DPR 1
- State: главная страница, меню закрыто, `prefers-reduced-motion: reduce`

## Additional viewports

- Desktop: 1366 × 768, 1440 × 810, 1920 × 1080
- Mobile: 390 × 844, 360 × 800
- Tablet: 768 × 1024

## Iterations

1. Исправлена плоская цепочка: анимационный transform больше не перекрывает диагональную раскладку.
2. Заголовок приведён к двум строкам на desktop, CTA отделены от карточек.
3. Значения конверсии разведены по нижней траектории, итоговая строка поднята в границы первого viewport.
4. Для mobile создана самостоятельная двухрядная цепочка без механического сжатия desktop-композиции.

## Interaction and browser checks

- Все 12 маршрутов, 404, sitemap и robots.
- Мобильное меню, FAQ, CTA, русская валидация формы.
- Клавиатурный фокус и `prefers-reduced-motion`.
- Горизонтальный overflow отсутствует.
- Первый экран, итоговая строка и trust-message находятся внутри desktop viewport.
- Ошибки browser console при визуальном прогоне: 0.

## Severity findings

- P0: 0
- P1: 0
- P2: 0

Final result: passed
