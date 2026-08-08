# Design QA

## Visual truth

- Source: `/workspace/scratch/efd8bca3fc24/upload/image(20260807-195036).png`
- Source dimensions: 1672 × 941 px
- Browser-rendered hero: `design-qa/screenshots/home-1672x941.png`
- Browser-rendered full page: `design-qa/screenshots/home-full-desktop.png`
- Same-input comparison: `design-qa/screenshots/comparison-redesign.png`
- Comparison viewport: hero 1672 × 941 CSS px; sections 1440 × 900 CSS px; DPR 1
- State: главная страница, меню закрыто, `prefers-reduced-motion: reduce`

## Focused evidence

- `design-qa/screenshots/problems-section-desktop.png`
- `design-qa/screenshots/journey-section-desktop.png`
- `design-qa/screenshots/directions-section-desktop.png`
- `design-qa/screenshots/owner-section-desktop.png`
- Соответствующие mobile-снимки при 390 × 844.

## Comparison history

1. Исходный hero задал визуальный язык: почти чёрный фон, диагональная цепочка, бирюзовые, синие, фиолетовые, розовые, оранжевые и лаймовые акценты.
2. По новой правке удалены финансовая итоговая строка и trust-message. Цепочка, заголовок, CTA, значения 67% и 24% сохранены.
3. Первый прогон переработанных секций выявил P2: недостаточный контраст описаний в цветных карточках. Исправлено повышением яркости текста.
4. Полностраничный прогон выявил P1: reveal-компоненты могли выглядеть почти пустыми вне viewport и при reduced motion. Убрана анимация прозрачности; сохранено короткое движение без сокрытия контента.
5. Повторный прогон подтвердил видимость всех секций, единый цветовой язык и отсутствие горизонтального overflow.

## Required fidelity surfaces

- Typography: Roboto Condensed, масштаб и строгая иерархия исходного hero сохранены.
- Spacing: desktop и mobile-секции проверены отдельно; карточки и интерактивная воронка не пересекаются.
- Colors: новые блоки используют ту же шестицветную палитру, что и коммерческая цепочка.
- Assets: исходный поток данных и библиотечные Phosphor Icons сохранены; заглушки не добавлялись.
- Copy: удалены указанные цифры, trust-блок и повторяющиеся формулировки; новые результаты и факты не придуманы.

## Interaction and browser checks

- Все 12 маршрутов, 404, sitemap и robots.
- Мобильное меню, FAQ, CTA и русская валидация формы.
- Переключение этапов воронки, кнопки предыдущего и следующего этапа.
- Клавиатурный фокус и `prefers-reduced-motion`.
- Ошибки browser console при визуальном прогоне: 0.

## Findings

- P0: 0
- P1: 0
- P2: 0

final result: passed
