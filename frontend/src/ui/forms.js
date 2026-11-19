// Перевірка форм у браузері та показ помилок біля полів.
//
// Правила тут ті самі, що й на сервері (backend/app/core/validators.py і схеми Pydantic).
// Перевірка в браузері — для зручності: людина бачить помилку одразу, без запиту.
// Захищає дані все одно сервер: запит можна надіслати й без нашої сторінки (Postman, curl),
// тому помилки 422 від сервера показуються в тих самих місцях, що й наші.
import { el, icon } from './dom.js'

// ---------- Правила. Кожне повертає текст помилки або null, якщо все гаразд ----------

export const required = (message = "Обов'язкове поле.") =>
  (value) => (value === '' ? message : null)

export const length = (min, max) => (value) => {
  if (value === '') return null                       // порожнє поле перевіряє required()
  if (value.length < min) return `Мінімальна довжина — ${min} симв.`
  if (value.length > max) return `Максимальна довжина — ${max} симв.`
  return null
}

export const email = () => (value) =>
  value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'Вкажіть коректну адресу пошти, наприклад name@example.com.'

export const integer = (min, max) => (value) => {
  if (value === '') return null
  if (!/^\d+$/.test(value)) return 'Має бути цілим числом.'
  const number = Number(value)
  if (number < min) return `Має бути не менше за ${min}.`
  if (number > max) return `Має бути не більше за ${max}.`
  return null
}

/** Власне правило: check(value, form) повертає true, якщо все гаразд. */
export const custom = (check, message) => (value, form) => (check(value, form) ? null : message)

// ---------- Робота з формою ----------

/** Значення поля без пробілів на початку й у кінці (так само робить сервер). */
export function fieldValue(form, name) {
  return (form.elements[name]?.value ?? '').trim()
}

/** Сам елемент поля. Для групи перемикачів (radio з однаковим name) — перший із них. */
function fieldElement(form, name) {
  const field = form.elements[name]
  return field instanceof RadioNodeList ? field[0] : field
}

/**
 * Перевіряє форму за правилами { назваПоля: [правило, правило…] }.
 * Показує першу помилку кожного поля під ним і ставить фокус на перше хибне поле.
 * Повертає true, якщо помилок немає.
 */
export function validateForm(form, rules) {
  clearErrors(form)
  let firstInvalid = null
  for (const [name, checks] of Object.entries(rules)) {
    const value = fieldValue(form, name)
    const message = checks.map((check) => check(value, form)).find(Boolean)
    if (message) {
      showFieldError(form, name, message)
      firstInvalid ??= fieldElement(form, name)
    }
  }
  firstInvalid?.focus()
  return firstInvalid === null
}

/**
 * Показує помилку під полем. Розмітка поля в HTML:
 *   <input id="email" name="email" aria-describedby="email-error">
 *   <p id="email-error" class="field-error" hidden></p>
 */
export function showFieldError(form, name, message) {
  const input = fieldElement(form, name)
  // Для групи перемикачів блок помилки називається за назвою групи: rating-error
  const errorId = form.elements[name] instanceof RadioNodeList ? name : input?.id || name
  const box = form.querySelector(`#${CSS.escape(errorId)}-error`)
  if (!input || !box) return false
  input.setAttribute('aria-invalid', 'true')        // червона рамка + читалка оголосить «недійсне»
  box.replaceChildren(icon('warning-circle', 'mt-0.5 shrink-0'), el('span', {}, message))
  box.hidden = false
  return true
}

/** Помилка всієї форми (блок data-form-error над кнопкою), наприклад «Неправильна пошта або пароль». */
export function showFormError(form, message) {
  const box = form.querySelector('[data-form-error]')
  if (!box) return
  box.replaceChildren(icon('warning-circle', 'mt-0.5 shrink-0 text-xl'), el('p', {}, message))
  box.hidden = false
}

/** Прибирає всі показані помилки форми. */
export function clearErrors(form) {
  for (const input of form.querySelectorAll('[aria-invalid]')) input.removeAttribute('aria-invalid')
  for (const box of form.querySelectorAll('.field-error, [data-form-error]')) {
    box.hidden = true
    box.replaceChildren()
  }
}

/**
 * Показує помилку від сервера (ApiError) у формі.
 * Помилки полів (422: errors = [{field, message}]) — під відповідними полями.
 * aliases перекладає назву поля з API в назву поля форми: { username: 'email' }.
 * Решта (409, 500, сервер недоступний) — загальним повідомленням над кнопкою.
 */
export function showServerErrors(form, error, aliases = {}) {
  clearErrors(form)
  // Якщо хоч одна помилка не знайшла свого поля (наприклад, items.0.quantity), показуємо ще й загальне
  // повідомлення: краще зайвий раз пояснити, ніж мовчки загубити причину відмови
  let allShown = true
  for (const { field, message } of error.errors ?? []) {
    if (!showFieldError(form, aliases[field] ?? field, message)) allShown = false
  }
  if (!allShown || (error.errors ?? []).length === 0) showFormError(form, error.message)
  form.querySelector('[aria-invalid="true"]')?.focus()
}

/**
 * Кнопка «зайнята», поки йде запит: її не можна натиснути вдруге (подвійне замовлення!),
 * а текст показує, що відбувається. Повертає функцію, яка повертає кнопку до звичайного стану.
 */
export function setBusy(button, busyText = 'Зачекайте…') {
  const original = [...button.childNodes]
  button.disabled = true
  button.setAttribute('aria-busy', 'true')
  button.replaceChildren(icon('spinner-gap', 'animate-spin'), busyText)
  return () => {
    button.disabled = false
    button.removeAttribute('aria-busy')
    button.replaceChildren(...original)
  }
}
