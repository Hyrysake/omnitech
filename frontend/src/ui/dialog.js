// Вікно підтвердження небезпечної дії («Видалити товар?»). Тег <dialog> вбудований у браузер:
// showModal() блокує решту сторінки, Escape закриває вікно, фокус лишається всередині.
import { el, icon } from './dom.js'

/** Повертає Promise: true — користувач підтвердив, false — скасував. Використання: if (await confirmDialog({...})) */
export function confirmDialog({ title, text, confirmLabel = 'Підтвердити', danger = true }) {
  return new Promise((resolve) => {
    const dialog = el('dialog', {
      class: 'm-auto w-[min(28rem,calc(100%-2rem))] rounded-2xl border border-line bg-card p-0 text-ink shadow-2xl backdrop:bg-ink/50 backdrop:backdrop-blur-sm dark:border-line-dark dark:bg-coal dark:text-paper',
      'aria-labelledby': 'dialog-title',
    },
    el('form', { method: 'dialog', class: 'p-6' },
      el('div', { class: 'flex items-start gap-4' },
        el('span', {
          class: danger
            ? 'grid size-11 shrink-0 place-items-center rounded-full bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400'
            : 'grid size-11 shrink-0 place-items-center rounded-full bg-gold/10 text-gold dark:bg-gold-bright/15 dark:text-gold-bright',
        }, icon(danger ? 'warning' : 'question', 'text-2xl')),
        el('div', {},
          el('h2', { id: 'dialog-title', class: 'text-lg font-semibold' }, title),
          text && el('p', { class: 'muted mt-2' }, text))),
      el('div', { class: 'mt-6 flex flex-wrap justify-end gap-3' },
        // value кнопки стає dialog.returnValue, коли форма з method="dialog" закриває вікно
        el('button', { value: 'cancel', class: 'btn btn-secondary', autofocus: true }, 'Скасувати'),
        el('button', { value: 'ok', class: danger ? 'btn btn-danger' : 'btn btn-primary' }, confirmLabel))))

    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'ok')
      dialog.remove()
    })
    document.body.append(dialog)
    dialog.showModal()
  })
}
