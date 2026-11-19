// Список бажань: зберігається на сервері (у кожного користувача свій), тому працює на будь-якому пристрої.
// Сторінка один раз завантажує номери товарів зі списку, а кнопки-серця змінюються одразу після кліку
// («оптимістично») і повертаються назад, якщо сервер відповів помилкою.
import { apiRequest } from '../api/client.js'
import { goToLogin } from '../auth/guards.js'
import { getUser } from '../auth/session.js'
import { el, icon } from '../ui/dom.js'
import { showToast } from '../ui/toast.js'

let savedIds = new Set()
const pending = new Set()   // товари, для яких запит ще йде

/** Завантажує номери товарів зі списку бажань (для гостя список порожній). */
export async function loadWishlist() {
  if (!getUser()) {
    savedIds = new Set()
    return
  }
  try {
    // 'optional': якщо токен уже не дійсний, головна чи каталог не перекинуть гостя на вхід
    setWishlist(await apiRequest('/api/v1/users/me/wishlist', { auth: 'optional' }))
  } catch {
    // Без списку бажань сторінка однаково працює: серця просто будуть порожні
    savedIds = new Set()
  }
}

/** Запам'ятовує, які товари в списку (з відповіді GET /users/me/wishlist), щоб не просити той самий список двічі. */
export function setWishlist(products) {
  savedIds = new Set(products.map((product) => product.id))
}

/** Малює серце як «натиснуте» чи ні. На сторінці може бути кілька сердець одного товару — оновлюємо всі. */
function paint(productId, saved) {
  for (const button of document.querySelectorAll(`[data-wishlist="${productId}"]`)) {
    button.setAttribute('aria-pressed', String(saved))
    button.replaceChildren(saved
      ? icon('heart', 'text-xl text-red-600 dark:text-red-500', 'ph-fill')
      : icon('heart', 'text-xl'))
  }
}

/** Додає товар у список (PUT) або прибирає (DELETE). Обидва запити ідемпотентні: повтор нічого не зламає. */
export async function toggleWishlist(product) {
  if (!getUser()) {
    goToLogin('Увійдіть, щоб зберігати товари в списку бажань.')
    return
  }
  // Поки сервер не відповів на попередній клік по цьому товару, нові кліки ігноруємо:
  // інакше подвійний клік надіслав би PUT і DELETE, і невідомо, який дійшов би останнім
  if (pending.has(product.id)) return
  pending.add(product.id)
  const wasSaved = savedIds.has(product.id)
  // Спершу змінюємо серце на сторінці, а вже потім чекаємо сервер: так інтерфейс реагує миттєво
  if (wasSaved) savedIds.delete(product.id)
  else savedIds.add(product.id)
  paint(product.id, !wasSaved)
  try {
    await apiRequest(`/api/v1/users/me/wishlist/${product.id}`, { method: wasSaved ? 'DELETE' : 'PUT', auth: true })
    showToast(wasSaved ? `«${product.name}» прибрано зі списку бажань.` : `«${product.name}» додано до списку бажань.`)
    window.dispatchEvent(new CustomEvent('wishlist:changed', { detail: { productId: product.id, saved: !wasSaved } }))
  } catch (error) {
    // Сервер не прийняв зміну — повертаємо серце, як було
    if (wasSaved) savedIds.add(product.id)
    else savedIds.delete(product.id)
    paint(product.id, wasSaved)
    if (error.status !== 401) showToast(error.message, 'error')
  } finally {
    pending.delete(product.id)
  }
}

/** Кнопка-серце для картки чи сторінки товару. */
export function heartButton(product) {
  const saved = savedIds.has(product.id)
  return el('button', {
    type: 'button',
    class: 'btn-icon',
    dataset: { wishlist: product.id },
    'aria-pressed': String(saved),
    'aria-label': `Список бажань: ${product.name}`,
    onClick: () => toggleWishlist(product),
  }, saved ? icon('heart', 'text-xl text-red-600 dark:text-red-500', 'ph-fill') : icon('heart', 'text-xl'))
}
