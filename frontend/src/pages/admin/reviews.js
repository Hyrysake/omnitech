// Адмін-панель, «Відгуки про товари»: GET /api/v1/admin/reviews, видалення — DELETE /api/v1/reviews/{id}
// (та сама адреса, що й для автора: сервер дозволяє видаляти відгук його автору або адміністратору)
import { apiRequest, isAbort } from '../../api/client.js'
import { initAdminPage } from '../../layout/admin.js'
import { confirmDialog } from '../../ui/dialog.js'
import { byId, el, icon } from '../../ui/dom.js'
import { formatDateTime } from '../../ui/format.js'
import { pageFromUrl, rememberPage, renderPagination } from '../../ui/pagination.js'
import { stars } from '../../ui/stars.js'
import { doneLoading, renderEmpty, renderError, renderLineSkeletons } from '../../ui/states.js'
import { showToast } from '../../ui/toast.js'

const list = byId('list')
const pagination = byId('pagination')
const totalLabel = byId('total')
let currentPage = pageFromUrl()
let controller = null

function reviewCard(review) {
  return el('article', { class: 'card p-5 sm:p-6' },
    el('header', { class: 'flex flex-wrap items-start justify-between gap-3' },
      el('div', {},
        el('a', { href: `/product.html?id=${review.product_id}`, class: 'link' }, review.product_name),
        el('p', { class: 'mt-1 font-semibold' }, review.author_name,
          review.user_id === null && el('span', { class: 'muted ml-2 text-xs font-normal' }, '(без акаунта)')),
        el('time', { class: 'muted text-sm', datetime: review.created_at }, formatDateTime(review.created_at))),
      stars(review.rating)),
    el('p', { class: 'mt-4 whitespace-pre-line break-words leading-relaxed' }, review.text),
    el('div', { class: 'mt-5' },
      el('button', { type: 'button', class: 'btn btn-danger', onClick: () => deleteReview(review) }, icon('trash'), 'Видалити відгук')))
}

async function loadReviews(page = currentPage) {
  currentPage = page
  rememberPage(page)
  controller?.abort()
  controller = new AbortController()
  renderLineSkeletons(list, 3)
  try {
    const data = await apiRequest('/api/v1/admin/reviews', { auth: true, query: { page, size: 10 }, signal: controller.signal })
    totalLabel.textContent = data.total
    renderPagination(pagination, data, loadReviews)
    if (data.items.length === 0 && data.total > 0) {
      // Такої сторінки вже немає (видалили останній запис на ній або в адресі завеликий ?page): показуємо останню
      loadReviews(data.pages)
      return
    }
    if (data.items.length === 0) {
      renderEmpty(list, { iconName: 'star', title: 'Відгуків ще немає', text: 'Відгуки покупців з’являться тут.' })
      return
    }
    doneLoading(list)
    list.replaceChildren(...data.items.map(reviewCard))
  } catch (error) {
    if (isAbort(error)) return
    if (error.status !== 401) renderError(list, error, () => loadReviews(page))
  }
}

async function deleteReview(review) {
  const confirmed = await confirmDialog({
    title: 'Видалити відгук?',
    text: `Відгук ${review.author_name} про «${review.product_name}» зникне зі сторінки товару, а рейтинг товару перерахується.`,
    confirmLabel: 'Видалити',
  })
  if (!confirmed) return
  try {
    await apiRequest(`/api/v1/reviews/${review.id}`, { method: 'DELETE', auth: true })
    showToast('Відгук видалено.')
    loadReviews()
  } catch (error) {
    if (error.status !== 401) showToast(error.message, 'error')
  }
}

if (initAdminPage('reviews')) loadReviews()
