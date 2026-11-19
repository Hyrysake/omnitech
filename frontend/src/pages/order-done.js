// «Дякуємо за замовлення». Дані беремо з sessionStorage (їх зберегла сторінка оформлення):
// гість не має доступу до GET /users/me/orders/{id}, а показати йому номер і склад замовлення треба
import { apiRequest } from '../api/client.js'
import { initPage } from '../layout/page.js'
import { byId, el, icon, render } from '../ui/dom.js'
import { formatDateTime } from '../ui/format.js'
import { orderItemsTable } from '../ui/order-view.js'
import { renderNotFound } from '../ui/states.js'
import { refreshEffects, revealIn } from '../layout/effects.js'

const user = initPage({ active: 'cart' })
const box = byId('done')
const orderId = Number(new URLSearchParams(location.search).get('id'))

function savedOrder() {
  try {
    const order = JSON.parse(sessionStorage.getItem('omnitech.lastOrder'))
    return order?.id === orderId ? order : null
  } catch {
    return null
  }
}

function showOrder(order) {
  render(box,
    el('header', { class: 'section-head page-head is-long' },
      el('h1', { class: 'lockup lockup-sm', 'data-reveal': '' },
        el('span', { class: 'serif' }, 'Дякуємо за покупку'), el('span', { class: 'sans' }, 'Замовлення прийнято')),
      el('p', { class: 'side', 'data-reveal': '' },
        `Замовлення №${order.id} від ${formatDateTime(order.created_at)}. `,
        `Ми зв'яжемося з вами за номером ${order.phone}, щоб підтвердити доставку.`)),
    el('span', { class: 'ct-ico mb-8', 'aria-hidden': 'true' }, icon('check', 'text-xl')),
    el('div', { class: 'lg:w-3/4' }, orderItemsTable(order)),
    el('div', { class: 'mt-10 flex flex-wrap gap-3' },
      user && el('a', { href: '/orders.html', class: 'btn btn-primary' }, 'Мої замовлення'),
      el('a', { href: '/catalog.html', class: user ? 'btn btn-secondary' : 'btn btn-primary' }, 'Продовжити покупки')))
  // Заголовок домальовано після завантаження сторінки: запускаємо появу слів
  revealIn(box)
  refreshEffects()
}

async function load() {
  const order = savedOrder()
  if (order) return showOrder(order)
  if (user && orderId > 0) {
    try {
      return showOrder(await apiRequest(`/api/v1/users/me/orders/${orderId}`, { auth: true }))
    } catch {
      // нижче — загальне повідомлення
    }
  }
  renderNotFound(box, {
    title: 'Замовлення не знайдено',
    text: 'Подробиці замовлень можна переглянути в розділі «Мої замовлення» після входу.',
    action: el('a', { href: '/catalog.html', class: 'btn btn-primary' }, 'До каталогу'),
  })
}

load()
