// «Мої замовлення»: GET /api/v1/users/me/orders (лише свої — сервер визначає користувача за токеном)
import { apiRequest } from '../api/client.js'
import { requireUser } from '../auth/guards.js'
import { initPage } from '../layout/page.js'
import { byId, el, icon } from '../ui/dom.js'
import { formatDateTime, formatPrice, plural } from '../ui/format.js'
import { statusBadge } from '../ui/order-status.js'
import { pageFromUrl, rememberPage, renderPagination } from '../ui/pagination.js'
import { doneLoading, renderEmpty, renderError, renderLineSkeletons } from '../ui/states.js'

initPage({ active: 'orders' })
const list = byId('orders')
const pagination = byId('pagination')

function orderCard(order) {
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0)
  return el('a', { href: `/order.html?id=${order.id}`, class: 'card row-card flex flex-wrap items-center gap-4 p-5 sm:p-7' },
    el('div', { class: 'min-w-0 basis-full sm:basis-0 sm:flex-1' },
      el('p', { class: 'flex flex-wrap items-center gap-3' },
        el('span', { class: 'price text-2xl' }, `Замовлення №${order.id}`), statusBadge(order.status)),
      el('p', { class: 'muted mt-1 text-sm' },
        `${formatDateTime(order.created_at)} · ${count} ${plural(count, ['товар', 'товари', 'товарів'])}`),
      el('p', { class: 'muted mt-1 truncate text-sm' }, order.items.map((item) => item.product_name).join(', '))),
    el('p', { class: 'price text-3xl' }, formatPrice(order.total)),
    icon('caret-right', 'muted ml-auto text-xl sm:ml-0'))
}

async function loadOrders(page = 1) {
  rememberPage(page)
  renderLineSkeletons(list, 3)
  try {
    const data = await apiRequest('/api/v1/users/me/orders', { auth: true, query: { page, size: 10 } })
    if (data.items.length === 0 && data.total > 0) {
      // Такої сторінки вже немає (видалили останній запис на ній або в адресі завеликий ?page): показуємо останню
      loadOrders(data.pages)
      return
    }
    renderPagination(pagination, data, (n) => {
      return loadOrders(n)
    })
    if (data.total === 0) {
      renderEmpty(list, {
        iconName: 'receipt',
        title: 'Замовлень ще немає',
        text: 'Тут з’явиться кожне замовлення, оформлене під вашим акаунтом.',
        action: el('a', { href: '/catalog.html', class: 'btn btn-primary' }, 'До каталогу'),
      })
      return
    }
    doneLoading(list)
    list.replaceChildren(...data.items.map(orderCard))
  } catch (error) {
    if (error.status !== 401) renderError(list, error, () => loadOrders(page))
  }
}

if (requireUser()) loadOrders(pageFromUrl())
