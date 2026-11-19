// Ілюстрації товарів: тонкі золоті лінії замість фото-заглушок. Кожна — набір SVG-фігур (viewBox 200×150, 4:3).
// Колір береться з CSS (currentColor), тож ілюстрація сама підлаштовується під світлу й темну тему.
// Фігури — сталі числа в коді, а не дані з сервера; елементи створюються через createElementNS (без innerHTML).

const SVG = 'http://www.w3.org/2000/svg'

// [тег, атрибути] ; клас soft — тонша, прозоріша лінія; fill — заповнена дрібниця
const ART = {
  laptop: [
    ['rect', { x: 50, y: 26, width: 100, height: 68, rx: 4 }],
    ['rect', { x: 57, y: 33, width: 86, height: 54, rx: 1.5, class: 'soft' }],
    ['path', { d: 'M30 102 H170 L162 114 Q160 117 155 117 H45 Q40 117 38 114 Z' }],
    ['path', { d: 'M86 102 L90 107 H110 L114 102', class: 'soft' }],
    ['path', { d: 'M66 80 L90 40 M78 82 L96 52', class: 'soft' }],
  ],
  phone: [
    ['rect', { x: 73, y: 12, width: 54, height: 116, rx: 10 }],
    ['rect', { x: 78, y: 21, width: 44, height: 98, rx: 5, class: 'soft' }],
    ['circle', { cx: 100, cy: 16.5, r: 1.4, class: 'fill' }],
    ['path', { d: 'M128 38 V52 M72 34 V42 M72 46 V56' }],
    ['path', { d: 'M86 104 L114 44', class: 'soft' }],
  ],
  tablet: [
    ['rect', { x: 30, y: 30, width: 128, height: 92, rx: 9 }],
    ['rect', { x: 38, y: 37, width: 112, height: 78, rx: 3, class: 'soft' }],
    ['circle', { cx: 94, cy: 33.5, r: 1.2, class: 'fill' }],
    ['path', { d: 'M150 132 L180 98 L184 102 L154 136 Z M150 132 L147 139 L154 136' }],
  ],
  headphones: [
    ['path', { d: 'M56 96 C56 36 144 36 144 96' }],
    ['path', { d: 'M64 92 C64 48 136 48 136 92', class: 'soft' }],
    ['rect', { x: 46, y: 86, width: 24, height: 40, rx: 11 }],
    ['rect', { x: 130, y: 86, width: 24, height: 40, rx: 11 }],
    ['path', { d: 'M70 94 V118 M130 94 V118', class: 'soft' }],
  ],
  turntable: [
    ['rect', { x: 32, y: 34, width: 136, height: 90, rx: 6 }],
    ['circle', { cx: 88, cy: 79, r: 35 }],
    ['circle', { cx: 88, cy: 79, r: 24, class: 'soft' }],
    ['circle', { cx: 88, cy: 79, r: 9 }],
    ['circle', { cx: 88, cy: 79, r: 1.6, class: 'fill' }],
    ['circle', { cx: 148, cy: 50, r: 6 }],
    ['path', { d: 'M148 56 V92 L124 106' }],
    ['path', { d: 'M140 114 H158', class: 'soft' }],
  ],
  interface: [
    ['rect', { x: 30, y: 52, width: 140, height: 50, rx: 7 }],
    ['circle', { cx: 56, cy: 77, r: 11 }],
    ['circle', { cx: 86, cy: 77, r: 11 }],
    ['path', { d: 'M56 70 V75 M86 70 V75' }],
    ['circle', { cx: 118, cy: 72, r: 4, class: 'soft' }],
    ['circle', { cx: 132, cy: 72, r: 4, class: 'soft' }],
    ['path', { d: 'M112 88 H152 M146 66 V68', class: 'soft' }],
    ['path', { d: 'M38 102 V108 M162 102 V108' }],
  ],
  gamepad: [
    ['path', { d: 'M62 56 C40 56 30 80 32 104 C34 122 50 126 60 114 L74 98 H126 L140 114 C150 126 166 122 168 104 C170 80 160 56 138 56 C128 56 124 62 100 62 C76 62 72 56 62 56 Z' }],
    ['path', { d: 'M64 70 V88 M55 79 H73' }],
    ['circle', { cx: 136, cy: 70, r: 3.6 }],
    ['circle', { cx: 146, cy: 79, r: 3.6 }],
    ['circle', { cx: 126, cy: 79, r: 3.6 }],
    ['circle', { cx: 136, cy: 88, r: 3.6 }],
    ['circle', { cx: 86, cy: 92, r: 7, class: 'soft' }],
    ['circle', { cx: 114, cy: 92, r: 7, class: 'soft' }],
  ],
  keyboard: [
    ['rect', { x: 18, y: 46, width: 164, height: 62, rx: 7 }],
    ...[0, 1, 2].flatMap((row) => Array.from({ length: 11 - (row === 2 ? 0 : 0) }, (_, col) =>
      ['rect', { x: 26 + col * 13.6, y: 54 + row * 13, width: 10.5, height: 9.5, rx: 2, class: 'soft' }])),
    ['rect', { x: 54, y: 93, width: 92, height: 9, rx: 2 }],
  ],
  mouse: [
    ['path', { d: 'M100 22 C74 22 66 44 66 70 V96 C66 118 82 130 100 130 C118 130 134 118 134 96 V70 C134 44 126 22 100 22 Z' }],
    ['path', { d: 'M100 22 V62 M66 62 H134', class: 'soft' }],
    ['rect', { x: 96.5, y: 34, width: 7, height: 15, rx: 3.5 }],
  ],
  monitor: [
    ['rect', { x: 22, y: 18, width: 156, height: 94, rx: 5 }],
    ['rect', { x: 29, y: 25, width: 142, height: 80, rx: 1.5, class: 'soft' }],
    ['path', { d: 'M92 112 L86 130 M108 112 L114 130 M68 132 H132' }],
  ],
  camera: [
    ['path', { d: 'M40 50 H74 L82 38 H118 L126 50 H160 Q167 50 167 57 V116 Q167 123 160 123 H40 Q33 123 33 116 V57 Q33 50 40 50 Z' }],
    ['circle', { cx: 100, cy: 86, r: 27 }],
    ['circle', { cx: 100, cy: 86, r: 18, class: 'soft' }],
    ['circle', { cx: 100, cy: 86, r: 8 }],
    ['rect', { x: 43, y: 59, width: 15, height: 8, rx: 2, class: 'soft' }],
    ['rect', { x: 136, y: 42, width: 15, height: 6, rx: 2 }],
    ['path', { d: 'M33 64 H72 M128 64 H167', class: 'soft' }],
  ],
  tlr: [
    ['rect', { x: 62, y: 20, width: 76, height: 112, rx: 6 }],
    ['path', { d: 'M66 20 L72 8 H128 L134 20' }],
    ['circle', { cx: 100, cy: 52, r: 16 }],
    ['circle', { cx: 100, cy: 52, r: 8, class: 'soft' }],
    ['circle', { cx: 100, cy: 98, r: 19 }],
    ['circle', { cx: 100, cy: 98, r: 10, class: 'soft' }],
    ['circle', { cx: 145, cy: 62, r: 7 }],
    ['path', { d: 'M138 62 H138.5', class: 'soft' }],
  ],
  box: [
    ['path', { d: 'M100 24 L160 54 V112 L100 140 L40 112 V54 Z' }],
    ['path', { d: 'M40 54 L100 82 L160 54 M100 82 V140' }],
    ['path', { d: 'M70 39 L130 69 V86', class: 'soft' }],
  ],
}

// Ключові слова в назві товару важливіші за категорію (у «Аудіо» є і навушники, і вертушка)
const BY_NAME = [
  [/навушник/i, 'headphones'], [/вертушк|програвач/i, 'turntable'], [/аудіоінтерфейс|інтерфейс/i, 'interface'],
  [/геймпад|джойстик/i, 'gamepad'], [/клавіатур/i, 'keyboard'], [/миш/i, 'mouse'], [/монітор/i, 'monitor'],
  [/плівков|tlr/i, 'tlr'], [/камер|фотоапарат/i, 'camera'], [/ноутбук|ультрабук/i, 'laptop'],
  [/смартфон|телефон/i, 'phone'], [/планшет/i, 'tablet'],
]
const BY_CATEGORY = {
  'Ноутбуки': 'laptop', 'Смартфони': 'phone', 'Планшети': 'tablet', 'Аудіо': 'headphones',
  'Ігрові аксесуари': 'gamepad', 'Периферія': 'keyboard', 'Фототехніка': 'camera',
}

/** Вид ілюстрації для товару: спершу за назвою, потім за категорією, інакше — коробка. */
export function kindForProduct(product) {
  const name = product?.name ?? ''
  for (const [pattern, kind] of BY_NAME) if (pattern.test(name)) return kind
  return BY_CATEGORY[product?.category?.name] ?? 'box'
}

export function kindForCategory(name) {
  return BY_CATEGORY[name] ?? BY_NAME.find(([pattern]) => pattern.test(name ?? ''))?.[1] ?? 'box'
}

/** Сам SVG (без підпису): для декоративного використання. */
export function artSvg(kind) {
  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 200 150')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  for (const [tag, attrs] of ART[kind] ?? ART.box) {
    const shape = document.createElementNS(SVG, tag)
    for (const [key, value] of Object.entries(attrs)) shape.setAttribute(key, value)
    svg.append(shape)
  }
  return svg
}

/** Ілюстрація з підписом для читалок (role="img" + aria-label — те саме, що alt у картинки). */
export function illustration(kind, label, extraClass = '') {
  const box = document.createElement('div')
  box.className = `illo ${extraClass}`.trim()
  box.setAttribute('role', 'img')
  box.setAttribute('aria-label', label)
  box.append(artSvg(kind))
  return box
}
