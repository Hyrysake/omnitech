// Побудова HTML-елементів з JavaScript.
//
// Чому не innerHTML: рядок `<p>${review.text}</p>` браузер розбирає як HTML. Якщо в тексті відгуку
// хтось написав <img src=x onerror="...">, цей код виконається в браузері кожного відвідувача (атака XSS).
// Функція el() створює елементи через document.createElement, а рядки додає як текстові вузли:
// будь-які < > у даних так і лишаються текстом. Тому в проєкті немає жодного innerHTML.

/**
 * el('a', { href: '/catalog.html', class: 'btn' }, 'Каталог') -> <a href="/catalog.html" class="btn">Каталог</a>
 *
 * props — атрибути. Особливі ключі:
 *   class     — рядок класів;
 *   dataset   — об'єкт data-атрибутів: { id: 5 } -> data-id="5";
 *   onClick, onSubmit… — обробники подій (лише функції);
 *   значення true дає атрибут без значення (hidden, disabled), а false/null/undefined — пропускається.
 * children — рядки, числа або інші елементи; null і false пропускаються (зручно для умов: cond && el(...)).
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue
    if (key === 'class') {
      node.className = value
    } else if (key === 'dataset') {
      Object.assign(node.dataset, value)
    } else if (key.startsWith('on')) {
      // Обробник як рядок (onclick="...") був би тим самим виконанням чужого коду, тому дозволена лише функція
      if (typeof value !== 'function') throw new TypeError(`${key} має бути функцією`)
      node.addEventListener(key.slice(2).toLowerCase(), value)
    } else {
      node.setAttribute(key, value === true ? '' : String(value))
    }
  }
  append(node, children)
  return node
}

/** Додає дітей у вузол: рядки стають текстом (не HTML), масиви розгортаються, null/false пропускаються. */
function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue
    node.append(child instanceof Node ? child : String(child))
  }
}

/** Замінює весь вміст елемента новими дітьми. */
export function render(container, ...children) {
  container.replaceChildren()
  append(container, children)
}

/** Іконка Phosphor: icon('truck') -> <i class="ph ph-truck" aria-hidden="true"></i> */
export function icon(name, extraClass = '', style = 'ph') {
  return el('i', { class: `${style} ph-${name} ${extraClass}`.trim(), 'aria-hidden': 'true' })
}

/** Короткий доступ до елемента за id; якщо його немає в HTML — одразу зрозуміла помилка. */
export function byId(id) {
  const node = document.getElementById(id)
  if (!node) throw new Error(`На сторінці немає елемента #${id}`)
  return node
}
