// Золота «шторка» між сторінками (View Transitions між документами).
// Перед тим як браузер «сфотографує» стару сторінку (подія pageswap), додаємо на неї шторку:
// золоту панель, контурні лінії, велике OMNI/TECH, назву сторінки, куди переходимо, і тонку смужку.
// Кожна частина має власну view-transition-name, тож CSS (site.css) анімує їх окремо:
// панель заходить знизу й іде вгору, текст рухається з легким паралаксом, смужка заповнюється.
// Без руху та для адмін-панелі перехід пропускає скрипт у <head>, і шторка не створюється.
import { el } from '../ui/dom.js'
import { motionOn } from './motion.js'

const NAMES = {
  '/': 'Головна', '/index.html': 'Головна', '/catalog.html': 'Каталог', '/product.html': 'Товар',
  '/about.html': 'Про нас', '/contacts.html': 'Контакти', '/faq.html': 'Часті питання',
  '/cart.html': 'Кошик', '/checkout.html': 'Оформлення', '/order-done.html': 'Дякуємо',
  '/login.html': 'Вхід', '/register.html': 'Реєстрація', '/profile.html': 'Профіль',
  '/orders.html': 'Мої замовлення', '/order.html': 'Замовлення', '/wishlist.html': 'Список бажань',
}

function curtain(label) {
  return el('div', { class: 'vt-curtain', 'aria-hidden': 'true' },
    el('div', { class: 'vt-panel' }),
    el('div', { class: 'vt-lines' }),
    el('div', { class: 'vt-mark' },
      el('span', { class: 'mega' }, el('span', { class: 'o' }, 'OMNI'), el('span', { class: 't' }, 'TECH')),
      el('span', { class: 'vt-label' }, label)),
    el('div', { class: 'vt-bar' }))
}

export function initTransitions() {
  // Повернулись «Назад» зі швидкого кешу (bfcache): стара шторка ще в DOM — прибираємо її до показу
  const clean = () => document.querySelectorAll('.vt-curtain').forEach((node) => node.remove())
  window.addEventListener('pageshow', clean)
  window.addEventListener('pagereveal', clean)
  // Маска з контурами для шторки має бути завантажена ДО переходу, інакше панель буде «пласкою»
  if (!document.querySelector('.vt-preload')) document.body.append(el('div', { class: 'vt-preload', 'aria-hidden': 'true' }))
  window.addEventListener('pageswap', (event) => {
    const transition = event.viewTransition
    const url = event.activation?.entry?.url
    if (!transition || !url || !motionOn()) return
    const target = new URL(url)
    if (target.origin !== location.origin || target.pathname.startsWith('/admin')) return
    document.body.append(curtain(NAMES[target.pathname] ?? ''))
  })
}
