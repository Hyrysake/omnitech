# Сторонній код і ліцензії

Тут перелічено все, що в проєкті OmniTech не написано нами. Версії записані в `frontend/package.json`; ліцензії перевірено в полі `license` кожного пакета в `node_modules`.

## Код, що потрапляє на сайт

| Що | Версія | Ліцензія | Де використано |
|---|---|---|---|
| GSAP (з плагіном ScrollTrigger) | 3.15.1 | GSAP «no charge» (безкоштовна ліцензія GSAP, `https://gsap.com/standard-license`). Це **не MIT** | `frontend/src/layout/scroll-fx.js`: закріплена розповідь на головній і спільний таймер із Lenis |
| Lenis | 1.3.27 | MIT | `frontend/src/layout/scroll-fx.js`: плавна прокрутка |
| `webgl-noise` (функції `mod289`, `permute`, `taylorInvSqrt`, `snoise`: шум simplex) | код 2011–2016 | MIT, Copyright (C) 2011 Ashima Arts, (C) 2011-2016 Stefan Gustavson | `frontend/src/layout/gl-contours.js`: усередині шейдера; авторство й ліцензія вказані в коментарі над ним |
| Шрифти Cormorant і Montserrat (`@fontsource/*`) | 5.3.0 | SIL Open Font License 1.1 | `frontend/src/styles/main.css` |
| Phosphor Icons (`@phosphor-icons/web`) | 2.1.2 | MIT | `frontend/src/styles/icons.css` (лише використані значки) |

## Інструменти збирання (на сайт не потрапляють)

| Що | Версія | Ліцензія |
|---|---|---|
| Vite | 8.3.8 | MIT |
| Tailwind CSS і `@tailwindcss/vite` | 4.3.5 | MIT |

## Що в цьому проєкті наше, а що взято як ідею

- Ідеї ефектів узято з чотирьох сайтів: заставка і товсті золоті лінії (lusion.co), контурні лінії на тлі (landonorris.com), поява тексту по словах і закріплена розповідь (santalarch.com), загальна схема «шари над одним тлом» (noomoagency.com). Це ідеї та поведінка, а не їхній код.
- Решту коду ефектів (`frontend/src/layout/*`, `frontend/src/ui/*`, `frontend/src/styles/*`, `frontend/src/boot.inline.js`) написано нами в межах навчального проєкту.
- Золоті ілюстрації товарів (`frontend/src/ui/illustrations.js`) намальовано фігурами SVG у коді.

## Бекенд

Python-залежності бекенду (FastAPI, SQLAlchemy та інші) перелічено в `backend/requirements.txt`. Їхні ліцензії тут не розбираються.
