// Адреса API та картинок.
// import.meta.env.VITE_API_URL — змінна з файлу frontend/.env (Vite підставляє її під час запуску).
// Якщо файлу .env немає, працюємо з API на цьому ж комп'ютері.
// replace(/\/+$/, '') прибирає скісну риску в кінці: 'http://x/' -> 'http://x'
export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000').replace(/\/+$/, '')

// Картинка-заглушка з папки public: показуємо, коли в товару немає фото або воно не завантажилось
export const PLACEHOLDER_IMAGE = '/placeholder.svg'

/**
 * Повна адреса картинки товару.
 * - '' (картинки немає) -> заглушка;
 * - '/media/products/abc.png' (файл, завантажений на наш API) -> 'http://127.0.0.1:8000/media/products/abc.png';
 * - 'https://...' (зовнішня адреса) -> без змін.
 * Будь-що інше (наприклад, 'javascript:...') -> заглушка: адреса з бази ніколи не потрапляє в src як є.
 */
export function mediaUrl(url) {
  if (typeof url !== 'string' || url === '') return PLACEHOLDER_IMAGE
  if (url.startsWith('/media/')) return API_URL + url
  if (url.startsWith('https://') || url.startsWith('http://')) return url
  return PLACEHOLDER_IMAGE
}
