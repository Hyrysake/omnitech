// Єдина функція для всіх запитів до API. Кожна сторінка викликає apiRequest(), а не fetch() напряму,
// тому формат запиту, обробка помилок і тайм-аут описані в одному місці.
import { API_URL } from './config.js'
import { clearSession, getToken } from '../auth/session.js'
import { goToLogin } from '../auth/guards.js'

// Скільки чекати відповіді сервера, мс. Без тайм-ауту запит до сервера, що «завис», чекав би вічно
const TIMEOUT_MS = 10_000

// Тексти для кодів, на які сервер не прислав власного пояснення (detail)
const STATUS_MESSAGES = {
  400: 'Запит не вдалося виконати.',
  401: 'Потрібно увійти в акаунт.',
  403: 'Недостатньо прав для цієї дії.',
  404: 'Не знайдено.',
  409: 'Дія суперечить наявним даним.',
  413: 'Файл завеликий.',
  415: 'Цей тип файлу не підтримується.',
  422: 'Перевірте правильність заповнення полів.',
  429: 'Забагато запитів. Зачекайте хвилину.',
}

/**
 * Помилка запиту до API.
 * kind: 'http' — сервер відповів кодом 4xx/5xx; 'network' — сервер недоступний; 'timeout' — не встиг відповісти.
 * status — HTTP-код (0, якщо відповіді не було); errors — список {field, message} для полів форми (код 422).
 */
export class ApiError extends Error {
  constructor(message, { status = 0, kind = 'http', errors = [] } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.kind = kind
    this.errors = errors
  }
}

/** Запит скасувала сама сторінка (наприклад, користувач змінив фільтр). Таку «помилку» не показуємо. */
export function isAbort(error) {
  return error?.name === 'AbortError'
}

/** Адреса з параметрами: buildUrl('/api/v1/products', {q: 'ноутбук', page: 2}) -> '...?q=...&page=2' */
function buildUrl(path, query) {
  const url = new URL(API_URL + path)
  for (const [key, value] of Object.entries(query ?? {})) {
    // Порожні значення не передаємо зовсім: ?q=&min_price= сервер сприйняв би як помилку
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
  }
  return url
}

/**
 * Надсилає запит до API і повертає розібраний JSON (або null для відповіді 204 без тіла).
 * Якщо щось пішло не так, кидає ApiError з українським текстом для користувача.
 *
 * Параметри (усі необов'язкові):
 *   method   — 'GET' (за замовчуванням), 'POST', 'PATCH', 'PUT', 'DELETE';
 *   query    — параметри адреси, об'єкт;
 *   body     — дані, які треба надіслати як JSON;
 *   form     — дані HTML-форми (application/x-www-form-urlencoded), так вимагає вхід OAuth2;
 *   formData — FormData з файлом (multipart/form-data);
 *   auth     — false (за замовчуванням): токен не надсилати; true: запит лише для того, хто ввійшов;
 *              'optional': надіслати токен, якщо він є (оформлення замовлення, серця на загальних сторінках);
 *   signal   — сигнал AbortController, щоб сторінка могла скасувати застарілий запит.
 */
export async function apiRequest(path, { method = 'GET', query, body, form, formData, auth = false, signal } = {}) {
  const headers = {}

  // Токен входу. getToken() повертає null, якщо токена немає або його термін уже минув
  const token = auth ? getToken() : null
  if (auth === true && !token) {
    // Сторінка потребує входу, а токена немає (або він прострочився): ведемо на сторінку входу
    sessionExpired('Увійдіть, щоб продовжити.')
    throw new ApiError(STATUS_MESSAGES[401], { status: 401 })
  }
  if (token) headers.Authorization = `Bearer ${token}`

  // Тіло запиту в одному з трьох форматів. Для FormData заголовок Content-Type НЕ ставимо вручну:
  // браузер сам допише туди межу (boundary) між частинами файлу
  let requestBody
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    requestBody = JSON.stringify(body)
  } else if (form) {
    requestBody = new URLSearchParams(form)
  } else if (formData) {
    requestBody = formData
  }

  // Запит перерветься або через 10 секунд, або коли сторінка сама його скасує — що станеться раніше
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout

  let response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: requestBody,
      signal: combinedSignal,
    })
  } catch (error) {
    // fetch() кидає виняток лише тоді, коли відповіді НЕМАЄ зовсім (коди 4xx/5xx — це не виняток!)
    if (signal?.aborted) throw error                       // скасувала сама сторінка — не показуємо
    if (timeout.aborted) {
      throw new ApiError('Сервер не відповідає. Спробуйте ще раз трохи згодом.', { kind: 'timeout' })
    }
    // TypeError: сервер вимкнений, немає мережі або браузер заблокував відповідь (CORS)
    throw new ApiError("Не вдалося з'єднатися із сервером. Перевірте інтернет-з'єднання і чи запущено API.",
      { kind: 'network' })
  }

  // 204 No Content: успіх без тіла відповіді (видалення, зміна пароля)
  if (response.status === 204) return null

  // Тіло відповіді — JSON. .catch: якщо прийшло щось інше (наприклад, HTML-сторінка проксі), не падаємо
  const data = await response.json().catch((error) => {
    // Запит скасували, поки тіло ще завантажувалось: це не «порожня відповідь», а скасування
    if (combinedSignal.aborted) throw signal?.aborted ? error : new ApiError('Сервер не відповідає. Спробуйте ще раз трохи згодом.', { kind: 'timeout' })
    return null
  })

  // response.ok — true лише для кодів 200–299. Саме його треба перевіряти: fetch не вважає 404 чи 500 помилкою
  if (!response.ok) {
    if (response.status === 401 && token) {
      // Токен був, але сервер його не прийняв (минув термін, акаунт видалено): забуваємо його.
      // Сторінка лише для тих, хто ввійшов (auth: true), веде на вхід; загальнодоступна просто працює далі як для гостя
      if (auth === true) sessionExpired('Термін дії входу минув. Увійдіть знову.')
      else clearSession()
    }
    const message = data?.detail
      ?? STATUS_MESSAGES[response.status]
      ?? (response.status >= 500 ? 'На сервері сталася помилка. Спробуйте пізніше.' : 'Запит не вдалося виконати.')
    throw new ApiError(message, { status: response.status, errors: data?.errors ?? [] })
  }
  return data
}

/** Забуває токен і переводить на сторінку входу з повідомленням; після входу користувач повернеться сюди. */
function sessionExpired(message) {
  clearSession()
  goToLogin(message)
}
