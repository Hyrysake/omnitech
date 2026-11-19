// Статуси замовлення: українська назва й колір «пігулки». Ключі — ті самі, що в API (OrderStatus у backend).
// Класи записані повністю, а не складені з частин ('bg-' + color): Tailwind знаходить класи пошуком
// тексту у файлах і рядок, складений під час роботи програми, не побачив би
import { el } from './dom.js'

export const ORDER_STATUSES = {
  new: { label: 'Нове', class: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200' },
  processing: { label: 'В обробці', class: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' },
  shipped: { label: 'Відправлено', class: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200' },
  completed: { label: 'Виконано', class: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' },
  cancelled: { label: 'Скасовано', class: 'bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200' },
}

export function statusBadge(status) {
  const info = ORDER_STATUSES[status] ?? { label: status, class: ORDER_STATUSES.new.class }
  return el('span', { class: `inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${info.class}` }, info.label)
}
