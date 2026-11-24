# Образ сайту OmniTech (лабораторна 08). Збірка з папки frontend:  docker build -t omnitech-frontend frontend
# Етапи: deps (пакети npm) -> dev (сервер Vite для розробки) / build (npm run build) -> фінальний образ Nginx.
# У фінальний образ потрапляє лише готовий сайт (кілька МБ) і Nginx, без Node.js та node_modules.

# ---------- Етап 1: пакети ----------
FROM node:22-alpine AS deps
WORKDIR /app
# Спершу лише package*.json: поки вони не змінились, шар з npm ci береться з кешу
COPY package.json package-lock.json ./
RUN npm ci

# ---------- Етап 2а: сервер розробки (compose.dev.yaml бере цей етап: build.target: dev) ----------
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---------- Етап 2б: збирання сайту ----------
FROM deps AS build
# Порожня адреса API = сайт звертається до /api на тому ж домені, а Nginx пересилає запити бекенду.
# Змінні VITE_* Vite вбудовує в код під час збирання, тому значення треба задати тут, а не під час запуску
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
COPY . .
RUN npm run build

# ---------- Етап 3: фінальний образ ----------
FROM nginx:alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# У alpine є wget від busybox. /healthz відповідає сам Nginx, без бекенду
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO /dev/null http://127.0.0.1/healthz || exit 1
