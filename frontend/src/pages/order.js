// Одне моє замовлення: GET /api/v1/users/me/orders/{id}. Чуже замовлення сервер «не знайде» (404),
// тож навіть підставивши в адресу чужий номер, побачити його не вийде
import { apiRequest } from '../api/client.js'
import { requireUser } from '../auth/guards.js'
import { initPage } from '../layout/page.js'
import { refreshEffects, revealIn } from '../layout/effects.js'
import { byId, el, render } from '../ui/dom.js'
import { formatDateTime } from '../ui/format.js'
import { statusBadge } from '../ui/order-status.js'
import { customerDetails, orderItemsTable } from '../ui/order-view.js'
import { renderError, renderLineSkeletons, renderNotFound, doneLoading } from '../ui/states.js'

initPage({ active: 'orders' })
const box = byId('order')
const raw = new URLSearchParams(location.search).get('id') ?? ''
const orderId = /^\d{1,10}$/.test(raw) ? Number(raw) : 0

function showMissing() {
  renderNotFound(box, {
    title: 'Замовлення не знайдено',
    text: 'Такого замовлення немає серед ваших.',
    action: el('a', { href: '/orders.html', class: 'btn btn-primary' }, 'Мої замовлення'),
  })
}

async function loadOrder() {
  if (orderId <= 0 || orderId > 2_147_483_647) return showMissing()
  renderLineSkeletons(box, 4)
  try {
    const order = await apiRequest(`/api/v1/users/me/orders/${orderId}`, { auth: true })
    document.title = `Замовлення №${order.id} | OmniTech`
    doneLoading(box)
    render(box,
      el('header', { class: 'section-head page-head' },
        el('h1', { class: 'lockup lockup-sm', 'data-reveal': '' },
          el('span', { class: 'serif' }, 'Деталі покупки'), el('span', { class: 'sans' }, `Замовлення №${order.id}`)),
        el('div', { class: 'side' },
          statusBadge(order.status),
          el('p', { class: 'mt-3' }, `Оформлено ${formatDateTime(order.created_at)}`))),
      el('div', { class: 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-10' },
        orderItemsTable(order),
        customerDetails(order)))
    revealIn(box)
    refreshEffects()
  } catch (error) {
    if (error.status === 404) showMissing()
    else if (error.status !== 401) renderError(box, error, loadOrder)
  }
}

if (requireUser()) loadOrder()
