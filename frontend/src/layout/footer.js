// Підвал сайту (однаковий на всіх сторінках): колонки посилань, перемикач «Рух», велике слово OMNITECH,
// обрізане нижнім краєм, і рядок авторських прав.
import { el } from '../ui/dom.js'
import { motionSwitch, roll } from './motion.js'
import { NAV } from './header.js'

function column(title, links) {
  return el('div', { class: 'col' },
    el('h2', {}, title),
    el('ul', {}, links.map(([href, label]) => el('li', {}, el('a', { href, class: 'wipe-host' }, roll(label))))))
}

export function renderFooter(container) {
  container.replaceChildren(el('footer', { class: 'site-footer' },
    el('div', { class: 'footer-grid' },
      column('Магазин', NAV.map((item) => [item.href, item.label])),
      column('Покупцям', [['/cart.html', 'Кошик'], ['/wishlist.html', 'Список бажань'], ['/orders.html', 'Мої замовлення'], ['/login.html', 'Увійти']]),
      el('div', { class: 'col' },
        el('h2', {}, 'Зв’язок'),
        el('p', { class: 'mt-4 max-w-[16rem] leading-relaxed text-[var(--fg-muted)]' }, 'Луцьк. Відповідаємо щодня з 9:00 до 20:00.'),
        el('a', { href: '/contacts.html', class: 'wipe mt-3 inline-block font-semibold' }, 'Написати нам')),
      el('div', { class: 'col' },
        el('h2', {}, 'Налаштування'),
        el('div', { class: 'mt-3' }, motionSwitch()),
        el('p', { class: 'mt-1 max-w-[16rem] text-sm leading-relaxed text-[var(--fg-muted)]' }, 'Вимикає анімації, заставку й плавну прокрутку.'))),
    el('div', { class: 'footer-mark', role: 'img', 'aria-label': 'OmniTech' },
      el('span', { class: 'mega', 'aria-hidden': 'true' }, el('span', { class: 'o' }, 'OMNI'), el('span', { class: 't' }, 'TECH'))),
    el('div', { class: 'footer-base' },
      el('p', {}, `© ${new Date().getFullYear()} OmniTech. Навчальний проєкт групи ІПЗ-22`),
      el('p', {}, 'Техніка. Точність. Тиша.'))))
}
