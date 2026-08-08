# Design QA

## Visual truth

- Source: `/workspace/scratch/efd8bca3fc24/upload/image(20260807-195036).png`
- Source dimensions: 1672 × 941 px
- Browser-rendered hero: `design-qa/screenshots/home-1672x941.png`
- Browser-rendered full page: `design-qa/screenshots/home-full-desktop.png`
- Same-input comparison: `design-qa/screenshots/comparison-redesign.png`
- Comparison viewport: hero 1672 × 941 CSS px; sections 1440 × 900 CSS px; DPR 1
- State: главная страница, меню закрыто, `prefers-reduced-motion: reduce`

### Страницы направлений

- Sources:
  - `/workspace/scratch/efd8bca3fc24/generated_images/exec-92ce6b30-ab45-497e-afc9-5b9ff4e0e3ef.png`
  - `/workspace/scratch/efd8bca3fc24/generated_images/exec-bd9cdd78-4e22-4b51-99e9-68aa8eb731ca.png`
  - `/workspace/scratch/efd8bca3fc24/generated_images/exec-9594bb7c-6d5d-489b-95f1-e60e3a20ddf2.png`
- Browser-rendered implementations: `design-qa/screenshots/directions/*-desktop.png` and `*-mobile.png`.
- Same-input comparisons: `design-qa/comparisons/*-side-by-side.png`.
- Viewports: 1440 × 900 and 390 × 844 CSS px, DPR 1.
- Source width normalized to 720 px for side-by-side comparison; implementation width normalized to 720 px without cropping.
- State: each direction page at the top, menu closed, `prefers-reduced-motion: reduce`.

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
6. Первый прогон страниц направлений выявил P2: содержание карточек было заметно короче утверждённых макетов. Дополнены сигналы, проверки, действия, данные и зоны ответственности по ТЗ.
7. Повторный desktop/mobile прогон подтвердил корректное размещение реальных фотографий, читаемость карточек, отсутствие overflow и работу внешних CTA.

## Required fidelity surfaces

- Typography: Roboto Condensed, масштаб и строгая иерархия исходного hero сохранены.
- Spacing: desktop и mobile-секции проверены отдельно; карточки и интерактивная воронка не пересекаются.
- Colors: новые блоки используют ту же шестицветную палитру, что и коммерческая цепочка.
- Assets: исходный поток данных и библиотечные Phosphor Icons сохранены; заглушки не добавлялись.
- Copy: удалены указанные цифры, trust-блок и повторяющиеся формулировки; новые результаты и факты не придуманы.
- Direction typography: крупные condensed-заголовки, плотность и контраст соответствуют выбранным макетам; на 390 px переносы не обрезают слова.
- Direction spacing: асимметричная сетка desktop перестраивается в один столбец на mobile; все CTA и портреты остаются в видимой области.
- Direction colors: для трёх направлений сохранены индивидуальные акценты — pink/violet, cyan/blue и lime/orange/cyan.
- Direction assets: используются реальный логотип и фотографии Дарьи, Егора и Рустама; заглушек и сгенерированных портретов в коде нет.
- Direction copy: внешние сайты указаны только для Дарьи и Егора; для Рустама адрес не выдуман.

## Interaction and browser checks

- Все 12 маршрутов, 404, sitemap и robots.
- Мобильное меню, FAQ, CTA и русская валидация формы.
- Переключение этапов воронки, кнопки предыдущего и следующего этапа.
- Клавиатурный фокус и `prefers-reduced-motion`.
- Ошибки browser console при визуальном прогоне: 0.
- Три страницы направлений проверены при 1440 × 900 и 390 × 844; внешние и внутренние CTA доступны с клавиатуры.

## Findings

- P0: 0
- P1: 0
- P2: 0

final result: passed
