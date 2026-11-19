// Сторінка товару: опис з API v2 і відгуки покупців (по 10, кнопка «Показати ще»)
import { apiRequest } from '../api/client.js'
import { initPage } from '../layout/page.js'
import { refreshEffects, revealIn } from '../layout/effects.js'
import { byId, el, icon, render } from '../ui/dom.js'
import { formatDate, formatPrice, plural } from '../ui/format.js'
import { productImage } from '../ui/product-card.js'
import { renderError, renderNotFound } from '../ui/states.js'
import { stars } from '../ui/stars.js'
import { addToCart } from '../store/cart.js'
import { showToast } from '../ui/toast.js'
import { initReviewForm } from '../ui/review-form.js'
import { heartButton, loadWishlist } from '../store/wishlist.js'

const user = initPage({ active: 'catalog' })

const box = byId('product')
const reviewsSection = byId('reviews-section')
const reviewsList = byId('reviews-list')
const reviewsSummary = byId('reviews-summary')
const moreButton = byId('reviews-more')
const REVIEWS_PAGE_SIZE = 10

/** Номер товару з адреси ?id=5. null, якщо його немає або це не додатне ціле число. */
function productIdFromUrl() {
  const raw = new URLSearchParams(location.search).get('id') ?? ''
  const id = Number(raw)
  return /^\d{1,10}$/.test(raw) && id > 0 && id <= 2_147_483_647 ? id : null
}

const productId = productIdFromUrl()
let reviewsPage = 0
let reviewForm = null

function showNotFound() {
  document.title = 'Товар не знайдено | OmniTech'
  reviewsSection.hidden = true
  renderNotFound(box, {
    title: 'Товар не знайдено',
    text: 'Можливо, його вже немає в продажу або адресу введено з помилкою.',
    action: el('a', { href: '/catalog.html', class: 'btn btn-primary' }, 'До каталогу'),
  })
}

async function loadProduct() {
  if (productId === null) {
    showNotFound()
    return
  }
  box.setAttribute('aria-busy', 'true')
  try {
    const [product] = await Promise.all([apiRequest(`/api/v2/products/${productId}`), loadWishlist()])
    box.removeAttribute('aria-busy')
    renderProduct(product)
    reviewsSection.hidden = false
    renderSummary(product.rating)
    await loadReviews(1)
    reviewForm ??= initReviewForm(byId('review-form-box'), { productId, user, onChange: refreshAfterReview })
    reviewForm.refresh()
  } catch (error) {
    box.removeAttribute('aria-busy')
    if (error.status === 404) showNotFound()
    else renderError(box, error, loadProduct)
  }
}

function renderProduct(product) {
  document.title = `${product.name} | OmniTech`
  render(box,
    // «Хлібні крихти»: де ми зараз у структурі сайту
    el('nav', { 'aria-label': 'Ви тут', class: 'pd-crumbs muted mb-8 md:mb-12' },
      el('ol', { class: 'flex flex-wrap items-center gap-2' },
        el('li', {}, el('a', { href: '/catalog.html', class: 'hover:underline' }, 'Каталог')),
        el('li', { 'aria-hidden': 'true' }, icon('caret-right', 'text-xs')),
        el('li', {}, el('a', { href: `/catalog.html?category=${product.category.id}`, class: 'hover:underline' }, product.category.name)),
        el('li', { 'aria-hidden': 'true' }, icon('caret-right', 'text-xs')),
        el('li', { class: 'truncate text-ink dark:text-paper', 'aria-current': 'page' }, product.name))),
    el('div', { class: 'pd-grid' },
      // Фото залипає під шапкою, поки гортаємо опис і відгуки праворуч (sticky діє від ширини lg)
      el('div', { class: 'pd-media relative self-start lg:sticky lg:top-24' },
        productImage(product, 'h-full')),
      el('div', { class: 'flex flex-col pt-8 lg:pt-0' },
        // Категорія «засічковим курсивом» над жирною назвою: той самий lockup, що в каталозі, але назву читаємо як h1
        el('p', { class: 'pd-kicker', 'data-reveal': '' }, product.category.name),
        el('div', { class: 'mt-3 flex items-start justify-between gap-4' },
          el('h1', { class: 'pd-title', 'data-reveal': '' }, product.name),
          heartButton(product),
        ),
        el('div', { class: 'muted mt-5 flex items-center gap-2 text-sm' },
          product.rating.count > 0
            ? [stars(product.rating.average), el('a', { href: '#reviews-section', class: 'hover:underline' },
              `${product.rating.count} ${plural(product.rating.count, ['відгук', 'відгуки', 'відгуків'])}`)]
            : 'Ще немає відгуків'),
        // whitespace-pre-line: переноси рядків з опису (адмін міг писати абзацами) видно на сторінці
        product.description && el('p', { class: 'muted mt-8 max-w-xl whitespace-pre-line text-lg leading-relaxed' }, product.description),
        // Панель покупки: ціна й кошик в одній рамці, залипає під шапкою на широкому екрані
        el('div', { class: 'pd-buy mt-10 lg:sticky lg:top-24' },
          el('p', { class: 'pd-price' }, formatPrice(product.price)),
          cartControls(product)),
        el('ul', { class: 'pd-perks mt-10' },
          el('li', {}, icon('seal-check', 'text-xl text-gold dark:text-gold-bright'), 'Офіційна гарантія від 12 місяців'),
          el('li', {}, icon('truck', 'text-xl text-gold dark:text-gold-bright'), 'Доставка по Україні за 1-2 дні'),
          el('li', {}, icon('arrows-counter-clockwise', 'text-xl text-gold dark:text-gold-bright'), '14 днів на повернення')))))
  // Новий вміст з API: слова заголовка з'являються по одному, позиції прокрутки перераховуються
  revealIn(box)
  refreshEffects()
}

/** Кількість і кнопка «У кошик». Кошик зберігається в браузері (localStorage), ціну рахує сервер. */
function cartControls(product) {
  const quantity = el('input', {
    id: 'quantity', type: 'number', min: 1, max: 99, value: 1, inputmode: 'numeric',
    class: 'input w-24 text-center tabular-nums', 'aria-label': 'Кількість',
  })
  return el('div', { class: 'mt-5 flex flex-wrap items-center gap-3' },
    quantity,
    el('button', {
      type: 'button',
      class: 'btn btn-primary min-h-12 flex-1 px-8 text-base',
      onClick: () => {
        // Кількість обмежуємо 1–99 (більше сервер не прийме)
        const count = Math.min(99, Math.max(1, Math.trunc(Number(quantity.value)) || 1))
        quantity.value = count
        addToCart(product.id, count)
        showToast(`«${product.name}» додано в кошик (${count} шт.).`)
      },
    }, icon('shopping-cart-simple', 'text-lg'), 'У кошик'))
}

function renderSummary(rating) {
  render(reviewsSummary, rating.count > 0
    ? [stars(rating.average, 'text-lg'),
        el('span', { class: 'tabular-nums' },
          `${rating.average.toFixed(1)} з 5 · ${rating.count} ${plural(rating.count, ['відгук', 'відгуки', 'відгуків'])}`)]
    : 'Ще немає відгуків')
}

function reviewItem(review) {
  const mine = user !== null && review.user_id === user.id
  return el('article', { class: 'card p-5 sm:p-6' },
    el('header', { class: 'flex flex-wrap items-center justify-between gap-3' },
      el('div', { class: 'flex items-center gap-3' },
        el('span', { class: 'grid size-10 place-items-center rounded-full bg-gold/10 font-semibold text-gold dark:bg-gold-bright/15 dark:text-gold-bright' },
          review.author_name.charAt(0).toUpperCase()),
        el('div', {},
          el('p', { class: 'font-semibold' }, review.author_name,
            mine && el('span', { class: 'ml-2 rounded-full bg-coal px-2 py-0.5 text-xs text-paper dark:bg-paper dark:text-ink' }, 'Ваш відгук'),
          ),
          el('p', { class: 'muted text-xs' }, el('time', { datetime: review.created_at }, formatDate(review.created_at))))),
      stars(review.rating)),
    el('p', { class: 'mt-4 whitespace-pre-line leading-relaxed' }, review.text))
}

/** Завантажує сторінку відгуків. page = 1 — список з початку, далі — дописуємо в кінець («Показати ще»). */
async function loadReviews(page) {
  moreButton.disabled = true
  try {
    const data = await apiRequest(`/api/v1/products/${productId}/reviews`, { query: { page, size: REVIEWS_PAGE_SIZE } })
    reviewsPage = page
    if (page === 1) reviewsList.replaceChildren()
    if (data.total === 0) {
      render(reviewsList, el('p', { class: 'card muted px-6 py-10 text-center' }, 'Ще ніхто не залишив відгук про цей товар.'))
    } else {
      reviewsList.append(...data.items.map(reviewItem))
    }
    moreButton.hidden = data.page >= data.pages
  } catch (error) {
    if (page === 1) renderError(reviewsList, error, () => loadReviews(1))
    else showLoadMoreError(error)
  } finally {
    moreButton.disabled = false
  }
}

/** Помилка довантаження: список уже є, тож замість цілого блоку помилки — коротке повідомлення під ним. */
function showLoadMoreError(error) {
  moreButton.after(el('p', { class: 'field-error ml-3', role: 'alert' }, error.message))
  setTimeout(() => moreButton.nextElementSibling?.remove(), 6000)
}

/** Після створення, зміни чи видалення відгуку оновлюємо рейтинг товару й список відгуків. */
async function refreshAfterReview() {
  try {
    const product = await apiRequest(`/api/v2/products/${productId}`)
    renderSummary(product.rating)
    renderProduct(product)
  } catch {
    // Рейтинг оновиться під час наступного відкриття сторінки
  }
  await loadReviews(1)
}

moreButton.addEventListener('click', () => loadReviews(reviewsPage + 1))
loadProduct()
