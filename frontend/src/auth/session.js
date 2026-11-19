// Сеанс входу: токен JWT і дані користувача в localStorage браузера.
//
// Чому localStorage: токен має пережити перезавантаження сторінки й перехід між сторінками.
// Ризик: будь-який JavaScript на сторінці може його прочитати, тому чужий код на сайт потрапити
// не повинен — саме для цього всі дані з API показуються лише як текст (див. src/ui/dom.js).
// Строк дії токена — 60 хвилин; після нього сервер відповість 401 і треба увійти знову.

export const SESSION_KEY = 'omnitech.auth'

/** Зберігає відповідь сервера на вхід: {access_token, expires_in (секунд), user}. */
export function saveSession({ access_token: token, expires_in: expiresIn, user }) {
  const expiresAt = Date.now() + expiresIn * 1000
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user, expiresAt }))
}

/** Поточний сеанс або null. Прострочений сеанс одразу видаляється: такий токен сервер усе одно не прийме. */
function readSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY))
    if (session && typeof session.token === 'string' && session.expiresAt > Date.now()) return session
  } catch {
    // Пошкоджений запис (хтось змінив його вручну) вважаємо відсутнім
  }
  localStorage.removeItem(SESSION_KEY)
  return null
}

export function getToken() {
  return readSession()?.token ?? null
}

/** Користувач, що ввійшов: {id, name, email, role, created_at}, або null для гостя. */
export function getUser() {
  return readSession()?.user ?? null
}

/** Оновлює збережені дані користувача (після зміни імені чи пошти в профілі). */
export function updateUser(user) {
  const session = readSession()
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, user }))
}

/** Вихід. Сервер нічого не «пам'ятає» про вхід, тож достатньо забути токен у браузері. */
export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}
