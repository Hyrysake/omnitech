// Адмін-панель: одне замовлення, зміна статусу (PATCH {status}) і видалення
import { apiRequest } from '../../api/client.js'
import { initAdminPage } from '../../layout/admin.js'
import { confirmDialog } from '../../ui/dialog.js'
import { byId, el, render } from '../../ui/dom.js'
import { setFlash } from '../../ui/flash.js'
import { formatDateTime } from '../../ui/format.js'
import { setBusy } from '../../ui/forms.js'
import { ORDER_STATUSES, statusBadge } from '../../ui/order-status.js'
import { customerDetails, orderItemsTable } from '../../ui/order-view.js'
import { doneLoading, renderError, renderLineSkeletons, renderNotFound } from '../../ui/states.js'
import { showToast } from '../../ui/toast.js'

const box = byId('order')
const raw = new URLSearchParams(location.search).get('id') ?? ''
const orderId = /^\d{1,10}$/.test(raw) ? Number(raw) : 0

function showMissing() {
  renderNotFound(box, {
    title: 'Замовлення не знайдено',
    text: 'Можливо, його вже видалили.',
    action: el('a', { href: '/admin/orders.html', class: 'btn btn-primary' }, 'До списку замовлень'),
  })
}

/** Форма зміни статусу: обрали новий статус — натиснули «Змінити статус». */
function statusForm(order) {
  const select = el('select', { id: 'new-status', class: 'input' },
    Object.entries(ORDER_STATUSES).map(([value, info]) => el('option', { value, selected: value === order.status }, info.label)))
  const form = el('form', { class: 'card space-y-4 p-6' },
    el('h2', { class: 'text-lg font-semibold' }, 'Статус замовлення'),
    el('div', {}, el('label', { for: 'new-status', class: 'label' }, 'Новий статус'), select),
    el('button', { type: 'submit', class: 'btn btn-primary w-full' }, 'Змінити статус'))
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (select.value === order.status) {
      showToast('Замовлення вже має цей статус.', 'info')
      return
    }
    const done = setBusy(form.querySelector('button'), 'Зберігаємо…')
    try {
      const updated = await apiRequest(`/api/v1/admin/orders/${order.id}`, { method: 'PATCH', auth: true, body: { status: select.value } })
      showToast(`Статус змінено: «${ORDER_STATUSES[updated.status].label}».`)
      showOrder(updated)
    } catch (error) {
      done()
      if (error.status === 404) showMissing()
      else if (error.status !== 401) showToast(error.message, 'error')
    }
  })
  return form
}

function deleteButton(order) {
  const button = el('button', { type: 'button', class: 'btn btn-danger w-full' }, 'Видалити замовлення')
  button.addEventListener('click', async () => {
    if (!await confirmDialog({ title: `Видалити замовлення №${order.id}?`, confirmLabel: 'Видалити' })) return
    try {
      await apiRequest(`/api/v1/admin/orders/${order.id}`, { method: 'DELETE', auth: true })
      setFlash(`Замовлення №${order.id} видалено.`)
      location.replace('/admin/orders.html')
    } catch (error) {
      if (error.status !== 401) showToast(error.message, 'error')
    }
  })
  return button
}

function showOrder(order) {
  document.title = `Замовлення №${order.id} — адмін-панель | OmniTech`
  render(box,
    el('div', { class: 'flex flex-wrap items-center gap-4' },
      el('h1', { class: 'page-title' }, `Замовлення №${order.id}`), statusBadge(order.status)),
    el('p', { class: 'muted mt-3' },
      `Оформлено ${formatDateTime(order.created_at)} · `,
      order.user_id ? `покупець з акаунтом (№${order.user_id})` : 'гість без акаунта'),
    el('div', { class: 'mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]' },
      el('div', { class: 'space-y-6' }, orderItemsTable(order), customerDetails(order)),
      el('div', { class: 'space-y-4' }, statusForm(order), deleteButton(order))))
}

async function loadOrder() {
  if (orderId <= 0 || orderId > 2_147_483_647) {
    showMissing()
    return
  }
  renderLineSkeletons(box, 4)
  try {
    const order = await apiRequest(`/api/v1/admin/orders/${orderId}`, { auth: true })
    doneLoading(box)
    showOrder(order)
  } catch (error) {
    if (error.status === 404) showMissing()
    else if (error.status !== 401) renderError(box, error, loadOrder)
  }
}

if (initAdminPage('orders')) loadOrder()
