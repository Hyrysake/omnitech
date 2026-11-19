// Переходи, пов'язані з входом: «спершу увійдіть», повернення назад після входу.
// Ці перевірки — лише для зручності. Захищає дані сервер: без правильного токена він відповість 401/403,
// навіть якщо хтось відкриє сторінку в обхід цього коду.
import { getUser } from './session.js'
import { setFlash } from '../ui/flash.js'

/**
 * Безпечна адреса повернення з параметра ?next=. Дозволяємо лише шлях на нашому сайті ('/orders.html').
 * Адреса '//evil.example' чи 'https://...' перевела б користувача на чужий сайт одразу після входу
 * (так званий open redirect), тому замість неї — головна.
 * Перевіряємо не сам рядок, а те, як його прочитає браузер: new URL() розбирає адресу так само, як перехід,
 * тож хитрощі на зразок '/\t/evil.example' (браузер викидає табуляцію й отримує '//evil.example') не пройдуть.
 */
export function safeNext(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/'
  try {
    const url = new URL(value, location.origin)
    if (url.origin === location.origin) return url.pathname + url.search + url.hash
  } catch {
    // Зламана адреса: просто йдемо на головну
  }
  return '/'
}

/** Куди повернутися після входу (з адреси поточної сторінки входу/реєстрації). */
export function nextFromUrl() {
  return safeNext(new URLSearchParams(location.search).get('next'))
}

/** Адреса сторінки входу, яка після успіху поверне на поточну сторінку. */
export function loginUrl() {
  const onAuthPage = ['/login.html', '/register.html'].includes(location.pathname)
  const next = onAuthPage ? nextFromUrl() : location.pathname + location.search
  return next === '/' ? '/login.html' : `/login.html?next=${encodeURIComponent(next)}`
}

/** Переходить на вхід із повідомленням. replace: кнопка «Назад» не поверне на сторінку, куди не пустили. */
export function goToLogin(message) {
  if (message) setFlash(message, 'info')
  location.replace(loginUrl())
}

/** Для сторінок лише для тих, хто ввійшов (профіль, мої замовлення). Повертає користувача або null. */
export function requireUser() {
  const user = getUser()
  if (!user) goToLogin('Увійдіть, щоб відкрити цю сторінку.')
  return user
}

/** На сторінках входу й реєстрації: хто вже ввійшов, того одразу повертаємо туди, куди він ішов. */
export function redirectIfLoggedIn() {
  if (!getUser()) return false
  location.replace(nextFromUrl())
  return true
}
