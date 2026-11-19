// Кошик у localStorage браузера: лише номери товарів і кількість, [{product_id: 3, quantity: 2}, ...].
// Ціни тут НЕ зберігаються: їх щоразу рахує сервер (POST /api/v1/cart/preview), тож підробити ціну
// в браузері неможливо, а якщо ціна змінилась, покупець одразу бачить нову.

export const CART_KEY = 'omnitech.cart'
export const MAX_QUANTITY = 99     // більше штук одного товару сервер не прийме
const MAX_LINES = 50               // і не більше 50 різних товарів в одному замовленні

/** Вміст кошика. Пошкоджені записи (хтось змінив localStorage вручну) відкидаємо. */
export function getCart() {
  try {
    const items = JSON.parse(localStorage.getItem(CART_KEY))
    if (!Array.isArray(items)) return []
    return items
      .filter((item) => Number.isInteger(item?.product_id) && item.product_id > 0 && Number.isInteger(item.quantity))
      .map((item) => ({ product_id: item.product_id, quantity: Math.min(MAX_QUANTITY, Math.max(1, item.quantity)) }))
      .slice(0, MAX_LINES)
  } catch {
    return []
  }
}

/** Зберігає кошик і повідомляє сторінку (подія cart:changed), щоб оновилось число біля іконки кошика. */
function save(items) {
  if (items.length === 0) localStorage.removeItem(CART_KEY)
  else localStorage.setItem(CART_KEY, JSON.stringify(items))
  window.dispatchEvent(new Event('cart:changed'))
}

/** Скільки штук усього (число біля іконки кошика). */
export function cartCount() {
  return getCart().reduce((sum, item) => sum + item.quantity, 0)
}

/** Додає товар; якщо він уже є — збільшує кількість (не більше 99). */
export function addToCart(productId, quantity = 1) {
  const items = getCart()
  const line = items.find((item) => item.product_id === productId)
  if (line) line.quantity = Math.min(MAX_QUANTITY, line.quantity + quantity)
  else if (items.length < MAX_LINES) items.push({ product_id: productId, quantity: Math.min(MAX_QUANTITY, quantity) })
  save(items)
}

export function setQuantity(productId, quantity) {
  save(getCart().map((item) => (item.product_id === productId
    ? { ...item, quantity: Math.min(MAX_QUANTITY, Math.max(1, quantity)) }
    : item)))
}

export function removeFromCart(productId) {
  save(getCart().filter((item) => item.product_id !== productId))
}

/** Прибирає товари, яких уже немає в каталозі (сервер повертає їх номери в полі missing). */
export function removeMissing(productIds) {
  if (productIds.length > 0) save(getCart().filter((item) => !productIds.includes(item.product_id)))
}

export function clearCart() {
  save([])
}
