// Адмін-панель, «Повідомлення»: GET /api/v1/admin/feedback?unread=, позначка прочитаного (PATCH), видалення
import { apiRequest, isAbort } from '../../api/client.js'
import { initAdminPage } from '../../layout/admin.js'
import { confirmDialog } from '../../ui/dialog.js'
import { byId, el, icon } from '../../ui/dom.js'
import { formatDateTime } from '../../ui/format.js'
import { pageFromUrl, rememberPage, renderPagination } from '../../ui/pagination.js'
import { doneLoading, renderEmpty, renderError, renderLineSkeletons } from '../../ui/states.js'
import { showToast } from '../../ui/toast.js'

const list = byId('list')
const pagination = byId('pagination')
const totalLabel = byId('total')
const unreadBox = byId('unread')
let currentPage = pageFromUrl()
let controller = null

// Картка з огляду адмінки веде сюди з ?unread=true: одразу вмикаємо цей фільтр
unreadBox.checked = new URLSearchParams(location.search).get('unread') === 'true'

function messageCard(item) {
  const toggle = el('button', {
    type: 'button',
    class: 'btn btn-secondary',
    onClick: () => markRead(item, !item.is_read, toggle),
  }, icon(item.is_read ? 'envelope-simple' : 'envelope-simple-open'), item.is_read ? 'Позначити непрочитаним' : 'Позначити прочитаним')
  return el('article', { class: `card p-5 sm:p-6 ${item.is_read ? '' : 'border-l-4 border-l-gold dark:border-l-gold-bright'}` },
    el('header', { class: 'flex flex-wrap items-start justify-between gap-3' },
      el('div', {},
        el('p', { class: 'flex flex-wrap items-center gap-2 font-semibold' },
          item.name,
          !item.is_read && el('span', { class: 'rounded-full bg-gold px-2 py-0.5 text-xs text-white dark:bg-gold-bright dark:text-ink' }, 'Нове')),
        // Пошту ввів сам відвідувач, тому показуємо її текстом, а не посиланням
        el('p', { class: 'muted break-all text-sm' }, item.email)),
      el('time', { class: 'muted text-sm', datetime: item.created_at }, formatDateTime(item.created_at))),
    el('p', { class: 'mt-4 whitespace-pre-line break-words leading-relaxed' }, item.message),
    el('div', { class: 'mt-5 flex flex-wrap gap-2' },
      toggle,
      el('button', { type: 'button', class: 'btn btn-danger', onClick: () => deleteMessage(item) }, icon('trash'), 'Видалити')))
}

async function loadMessages(page = currentPage) {
  currentPage = page
  rememberPage(page)
  controller?.abort()
  controller = new AbortController()
  renderLineSkeletons(list, 3)
  try {
    const data = await apiRequest('/api/v1/admin/feedback', {
      auth: true, query: { unread: unreadBox.checked ? true : null, page, size: 10 }, signal: controller.signal,
    })
    if (data.items.length === 0 && data.total > 0) {
      // Такої сторінки вже немає (видалили останній запис на ній або в адресі завеликий ?page): показуємо останню
      loadMessages(data.pages)
      return
    }
    totalLabel.textContent = data.total
    renderPagination(pagination, data, loadMessages)
    if (data.items.length === 0) {
      renderEmpty(list, {
        iconName: 'envelope-simple',
        title: unreadBox.checked ? 'Непрочитаних повідомлень немає' : 'Повідомлень ще немає',
        text: 'Нові звернення з форми «Контакти» з’являться тут.',
      })
      return
    }
    doneLoading(list)
    list.replaceChildren(...data.items.map(messageCard))
  } catch (error) {
    if (isAbort(error)) return
    if (error.status !== 401) renderError(list, error, () => loadMessages(page))
  }
}

async function markRead(item, isRead, button) {
  button.disabled = true
  try {
    await apiRequest(`/api/v1/admin/feedback/${item.id}`, { method: 'PATCH', auth: true, body: { is_read: isRead } })
    showToast(isRead ? 'Позначено прочитаним.' : 'Позначено непрочитаним.')
    loadMessages()
  } catch (error) {
    button.disabled = false
    if (error.status !== 401) showToast(error.message, 'error')
  }
}

async function deleteMessage(item) {
  if (!await confirmDialog({ title: `Видалити повідомлення від ${item.name}?`, confirmLabel: 'Видалити' })) return
  try {
    await apiRequest(`/api/v1/admin/feedback/${item.id}`, { method: 'DELETE', auth: true })
    showToast('Повідомлення видалено.')
    loadMessages()
  } catch (error) {
    if (error.status !== 401) showToast(error.message, 'error')
  }
}

unreadBox.addEventListener('change', () => loadMessages(1))

if (initAdminPage('feedback')) loadMessages()
