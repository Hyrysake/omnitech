// Налаштування Vite: сервер для розробки (npm run dev) і збирання готового сайту (npm run build)
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// Абсолютний шлях до HTML-файлу сторінки (папка цього файлу + ім'я)
const page = (file) => resolve(import.meta.dirname, file)

// Вхідний скрипт (тема, рух, заставка) лежить в одному файлі src/boot.inline.js. У кожній сторінці стоїть лише маркер
// <!--boot-->, а Vite підставляє на його місце вміст файлу, і в режимі розробки, і при збиранні.
const bootScript = {
  name: 'omnitech-boot-script',
  transformIndexHtml: {
    order: 'pre',
    handler(html) {
      const code = readFileSync(resolve(import.meta.dirname, 'src/boot.inline.js'), 'utf-8')
      return html.replace('<!--boot-->', `<script>
${code}  </script>`)
    },
  },
}

// Під час збирання Vite ставить <link rel="stylesheet"> у кінець <head>, після скриптів. Переносимо його
// на початок: тоді стилі (зокрема @view-transition для золотої «шторки») точно є вже на першому кадрі
// нової сторінки. Інакше браузер іноді малює перший кадр без них і пропускає перехід між сторінками.
const cssFirst = {
  name: 'omnitech-css-first',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler(html) {
      const links = html.match(/\s*<link rel="stylesheet"[^>]*>/g) ?? []
      let out = html
      for (const link of links) out = out.replace(link, '')
      return out.replace(/(<meta name="viewport"[^>]*>)/, `$1${links.join('')}`)
    },
  },
}

export default defineConfig({
  // Tailwind CSS 4 підключається як плагін Vite: стилі генеруються з класів, знайдених у HTML і JS
  plugins: [tailwindcss(), bootScript, cssFirst],

  // Багатосторінковий сайт (multi-page app): невідома адреса дає 404, а не головну сторінку
  appType: 'mpa',

  // Порт 5173 зафіксовано: саме його API дозволяє в налаштуваннях CORS.
  // strictPort — якщо порт зайнятий, Vite зупиниться з помилкою, а не перейде тихо на 5174
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },

  build: {
    // Кожна сторінка сайту — окремий HTML-файл. Vite збирає їх усі в папку dist
    rolldownOptions: {
      input: {
        home: page('index.html'),
        notFound: page('404.html'),
        catalog: page('catalog.html'),
        product: page('product.html'),
        login: page('login.html'),
        register: page('register.html'),
        profile: page('profile.html'),
        adminDashboard: page('admin/index.html'),
        adminProducts: page('admin/products.html'),
        adminProduct: page('admin/product.html'),
        adminCategories: page('admin/categories.html'),
        adminUsers: page('admin/users.html'),
        about: page('about.html'),
        faq: page('faq.html'),
        contacts: page('contacts.html'),
        cart: page('cart.html'),
        checkout: page('checkout.html'),
        orderDone: page('order-done.html'),
        orders: page('orders.html'),
        order: page('order.html'),
        adminOrders: page('admin/orders.html'),
        adminOrder: page('admin/order.html'),
        adminFeedback: page('admin/feedback.html'),
        wishlist: page('wishlist.html'),
        adminReviews: page('admin/reviews.html'),
      },
    },
  },
})
