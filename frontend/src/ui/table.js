// Таблиця адмін-панелі з опису колонок:
//   dataTable([{ label: 'Назва', cell: (row) => row.name }, ...], rows, 'Підпис таблиці')
// cell повертає текст або елемент. Порожній список таблиця не малює — для нього є renderEmpty().
import { el } from './dom.js'

export function dataTable(columns, rows, caption) {
  return el('table', { class: 'data-table' },
    // caption потрібен екранній читалці («Таблиця: Товари»); на екрані він прихований (sr-only)
    el('caption', { class: 'sr-only' }, caption),
    el('thead', {}, el('tr', {}, columns.map((column) =>
      el('th', { scope: 'col', class: column.headClass ?? '' }, column.label)))),
    el('tbody', {}, rows.map((row) => el('tr', {}, columns.map((column) =>
      el('td', { class: column.class ?? '' }, column.cell(row)))))))
}
