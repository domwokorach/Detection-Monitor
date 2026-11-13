FROM node:22-alpine AS build
WORKDIR /site
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
# Publishable (public) Logo.dev key only. The secret key stays in the API container.
ARG VITE_LOGO_DEV_PUBLISHABLE_KEY=
ENV VITE_LOGO_DEV_PUBLISHABLE_KEY=$VITE_LOGO_DEV_PUBLISHABLE_KEY
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /site/dist /usr/share/nginx/html
EXPOSE 80
