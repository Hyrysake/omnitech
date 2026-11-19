// Спільні частини сторінок замовлення: таблиця товарів і дані покупця (для покупця й для адміністратора)
import { el } from './dom.js'
import { formatPrice } from './format.js'
import { dataTable } from './table.js'

/** Товари замовлення з цінами НА МОМЕНТ ПОКУПКИ (вони не змінюються, навіть якщо змінилась ціна в каталозі). */
export function orderItemsTable(order) {
  // tabindex: на вузькому екрані таблиця гортається вбік, і з клавіатури до неї треба мати змогу дійти
  return el('div', { class: 'table-wrap', tabindex: 0, role: 'region', 'aria-label': `Склад замовлення №${order.id}` },
    dataTable([
      { label: 'Товар', cell: (item) => el('span', { class: 'font-semibold' }, item.product_name) },
      { label: 'Ціна', cell: (item) => formatPrice(item.price), class: 'whitespace-nowrap tabular-nums' },
      { label: 'Кількість', cell: (item) => `${item.quantity} шт.`, class: 'whitespace-nowrap tabular-nums' },
      { label: 'Сума', cell: (item) => formatPrice(item.line_total), class: 'whitespace-nowrap text-right font-semibold tabular-nums', headClass: 'text-right' },
    ], order.items, `Товари замовлення №${order.id}`),
    el('p', { class: 'flex justify-between gap-4 border-t border-line px-4 py-4 text-lg font-semibold dark:border-line-dark' },
      el('span', {}, 'Разом'), el('span', { class: 'tabular-nums' }, formatPrice(order.total))))
}

/** Дані покупця й доставки. */
export function customerDetails(order) {
  const row = (label, value) => el('div', { class: 'py-3' },
    el('dt', { class: 'muted text-sm' }, label),
    el('dd', { class: 'mt-0.5 break-words font-medium' }, value))
  return el('dl', { class: 'card divide-y divide-line px-6 py-2 dark:divide-line-dark' },
    row("Ім'я", order.customer_name),
    row('Телефон', order.phone),
    row('Пошта', order.email),
    row('Адреса доставки', order.address))
}
