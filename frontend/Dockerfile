# syntax=docker/dockerfile:1.7
#
# The web app, built for the real backend and served by nginx. nginx also forwards /api to the gateway,
# so the browser talks to one address and needs no CORS.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Behind a company proxy: pass HTTPS_PROXY as a build argument and its certificate as a build secret
# (docker build --build-arg HTTPS_PROXY=... --secret id=ca,src=proxy-ca.crt). Normal builds need neither.
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=secret,id=ca,target=/run/extra-ca.crt,required=false \
    if [ -f /run/extra-ca.crt ]; then export NODE_EXTRA_CA_CERTS=/run/extra-ca.crt; fi; \
    npm ci --no-audit --no-fund
COPY . .
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_CURRENCY=BDT
ENV VITE_USE_MOCKS=false \
    VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_CURRENCY=${VITE_CURRENCY}
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
