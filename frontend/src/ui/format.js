// Форматування чисел і дат українською (Intl — вбудований у браузер модуль локалізації)

const priceFormat = new Intl.NumberFormat('uk-UA')
const dateFormat = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat('uk-UA', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

/** 32999 -> '32 999 грн' */
export function formatPrice(value) {
  return `${priceFormat.format(value)} грн`
}

/**
 * Дата з API. Сервер зберігає час у UTC, але без позначки часового поясу ('2026-11-13T09:20:00').
 * Такий рядок браузер прочитав би як місцевий час і зсунув би його на 2–3 години.
 * Тому дописуємо 'Z' (UTC), якщо пояса в рядку немає.
 */
export function parseDate(value) {
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(value)
  return new Date(hasZone ? value : `${value}Z`)
}

/** '2026-11-13T09:20:00' -> '13 листопада 2026 р.' */
export function formatDate(value) {
  return dateFormat.format(parseDate(value))
}

/** '2026-11-13T09:20:00' -> '13 лист. 2026 р., 11:20' (за часом комп'ютера користувача) */
export function formatDateTime(value) {
  return dateTimeFormat.format(parseDate(value))
}

/** Правильна форма слова після числа: plural(3, ['товар', 'товари', 'товарів']) -> 'товари' */
export function plural(count, [one, few, many]) {
  const rule = new Intl.PluralRules('uk-UA').select(count)
  return rule === 'one' ? one : rule === 'few' ? few : many
}
