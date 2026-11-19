// Адмін-панель, «Категорії»: список з кількістю товарів, додавання, перейменування, видалення
import { apiRequest } from '../../api/client.js'
import { initAdminPage } from '../../layout/admin.js'
import { confirmDialog } from '../../ui/dialog.js'
import { byId, el, icon } from '../../ui/dom.js'
import { fieldValue, length, required, setBusy, showFieldError, showServerErrors, validateForm } from '../../ui/forms.js'
import { doneLoading, renderEmpty, renderError, renderLineSkeletons } from '../../ui/states.js'
import { dataTable } from '../../ui/table.js'
import { showToast } from '../../ui/toast.js'

const table = byId('table')
const addForm = byId('add-form')
const NAME_RULES = [required('Вкажіть назву категорії.'), length(2, 50)]

async function loadCategories() {
  renderLineSkeletons(table, 4)
  try {
    const categories = await apiRequest('/api/v1/categories')
    if (categories.length === 0) {
      renderEmpty(table, { iconName: 'tag', title: 'Категорій ще немає', text: 'Додайте першу категорію у формі вище.' })
      return
    }
    doneLoading(table)
    table.replaceChildren(dataTable(COLUMNS, categories, 'Категорії'))
  } catch (error) {
    renderError(table, error, loadCategories)
  }
}

/** Назва категорії — це одразу форма перейменування: змінили текст, натиснули «Зберегти» (або Enter). */
function renameForm(category) {
  const inputId = `category-${category.id}`
  const form = el('form', { novalidate: true, class: 'flex min-w-64 items-start gap-2' },
    el('div', { class: 'flex-1' },
      el('label', { for: inputId, class: 'sr-only' }, `Назва категорії «${category.name}»`),
      el('input', { id: inputId, name: 'name', value: category.name, maxlength: 50, class: 'input', 'aria-describedby': `${inputId}-error` }),
      el('p', { id: `${inputId}-error`, class: 'field-error', hidden: true }),
      el('div', { 'data-form-error': '', class: 'alert alert-error mt-2', role: 'alert', hidden: true })),
    el('button', { type: 'submit', class: 'btn-icon', 'aria-label': `Зберегти назву «${category.name}»` }, icon('floppy-disk', 'text-lg')))

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!validateForm(form, { name: NAME_RULES })) return
    const name = fieldValue(form, 'name')
    if (name === category.name) return
    const done = setBusy(form.querySelector('button'), '')
    try {
      const updated = await apiRequest(`/api/v1/categories/${category.id}`, { method: 'PATCH', auth: true, body: { name } })
      showToast(`Категорію перейменовано на «${updated.name}».`)
      loadCategories()
    } catch (error) {
      done()
      // 409: категорія з такою назвою вже є
      if (error.status === 409) showFieldError(form, 'name', error.message)
      else showServerErrors(form, error)
    }
  })
  return form
}

const COLUMNS = [
  { label: 'Назва', cell: renameForm },
  { label: 'Товарів', cell: (category) => category.product_count, class: 'tabular-nums' },
  {
    label: 'Дії',
    headClass: 'text-right',
    class: 'text-right',
    cell: (category) => el('button', {
      type: 'button',
      class: 'btn-icon inline-grid text-red-700 dark:text-red-400',
      // У категорії з товарами кнопка неактивна, а підказка пояснює чому (сервер однаково відповів би 409)
      disabled: category.product_count > 0,
      title: category.product_count > 0 ? 'У категорії є товари' : null,
      'aria-label': `Видалити категорію «${category.name}»`,
      onClick: () => deleteCategory(category),
    }, icon('trash', 'text-lg')),
  },
]

async function deleteCategory(category) {
  if (!await confirmDialog({ title: `Видалити категорію «${category.name}»?`, confirmLabel: 'Видалити' })) return
  try {
    await apiRequest(`/api/v1/categories/${category.id}`, { method: 'DELETE', auth: true })
    showToast(`Категорію «${category.name}» видалено.`)
    loadCategories()
  } catch (error) {
    if (error.status !== 401) showToast(error.message, 'error')
  }
}

addForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (!validateForm(addForm, { name: NAME_RULES })) return
  const done = setBusy(addForm.querySelector('button[type=submit]'), 'Додаємо…')
  try {
    const created = await apiRequest('/api/v1/categories', { method: 'POST', auth: true, body: { name: fieldValue(addForm, 'name') } })
    addForm.reset()
    showToast(`Категорію «${created.name}» додано.`)
    loadCategories()
  } catch (error) {
    if (error.status === 409) showFieldError(addForm, 'name', error.message)
    else showServerErrors(addForm, error)
  } finally {
    done()
  }
})

if (initAdminPage('categories')) loadCategories()
