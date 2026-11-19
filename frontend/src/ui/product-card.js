// Картка товару для головної, каталогу й списку бажань (товар у форматі API v2: з категорією й рейтингом)
import { mediaUrl } from '../api/config.js'
import { el, icon } from './dom.js'
import { formatPrice } from './format.js'
import { stars } from './stars.js'
import { addToCart } from '../store/cart.js'
import { showToast } from './toast.js'
import { heartButton } from '../store/wishlist.js'
import { illustration, kindForProduct } from './illustrations.js'

/**
 * Чи є в товару справжнє фото. Демо-дані посилаються на випадкові фото-заглушки (picsum.photos),
 * схожі на техніку лише приблизно, — замість них показуємо намальовану ілюстрацію.
 */
function hasRealImage(url) {
  return typeof url === 'string' && url !== '' && !/^https?:\/\/(?:[\w-]+\.)?picsum\.photos\//i.test(url)
}

/** Картинка товару: справжнє фото, а якщо його немає або воно не завантажилось — золота ілюстрація. */
export function productImage(product, extraClass = '') {
  const fallback = () => illustration(kindForProduct(product), product.name, extraClass)
  if (!hasRealImage(product.image_url)) return fallback()
  return el('img', {
    src: mediaUrl(product.image_url),
    alt: product.name,
    width: 600,
    height: 450,
    loading: 'lazy',
    class: `aspect-[4/3] w-full bg-stone-200 object-cover dark:bg-stone-800 ${extraClass}`,
    onError: (event) => event.target.replaceWith(fallback()),
  })
}

export function productCard(product) {
  return el('article', { class: 'pcard group' },
    // Уся верхня частина картки — посилання на сторінку товару; номер товару передаємо в адресі (?id=5)
    el('a', { href: `/product.html?id=${product.id}`, class: 'block' },
      el('div', { class: 'pcard-media' }, productImage(product)),
      el('div', { class: 'px-5 pt-5 pb-3' },
        el('p', { class: 'eyebrow' }, product.category.name),
        el('h3', { class: 'pcard-title' }, product.name),
        el('div', { class: 'muted mt-2 flex items-center gap-2 text-sm' },
          product.rating.count > 0
            ? [stars(product.rating.average, 'text-sm'), el('span', { class: 'tabular-nums' }, `(${product.rating.count})`)]
            : 'Ще немає відгуків'))),
    el('div', { class: 'absolute right-3 top-3 rounded-full bg-card/85 backdrop-blur dark:bg-coal/85' }, heartButton(product)),
    el('div', { class: 'mt-auto flex items-center justify-between gap-3 px-5 pb-5 pt-2' },
      el('p', { class: 'pcard-price' }, formatPrice(product.price)),
      el('button', {
        type: 'button',
        class: 'pill pill-loud size-11 px-0',
        'aria-label': `Додати в кошик: ${product.name}`,
        onClick: () => {
          addToCart(product.id, 1)
          showToast(`«${product.name}» додано в кошик.`)
        },
      }, icon('shopping-cart-simple', 'text-lg'))))
}
