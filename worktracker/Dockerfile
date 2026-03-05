# syntax=docker/dockerfile:1.7

FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG SUPABASE_URL=
ARG SUPABASE_ANON_KEY=
ARG GOOGLE_IOS_REVERSED_CLIENT_ID=
ARG EAS_PROJECT_ID=

ENV SUPABASE_URL=$SUPABASE_URL
ENV SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
ENV GOOGLE_IOS_REVERSED_CLIENT_ID=$GOOGLE_IOS_REVERSED_CLIENT_ID
ENV EAS_PROJECT_ID=$EAS_PROJECT_ID

RUN npm run build:web

FROM --platform=$TARGETPLATFORM nginx:alpine AS production

COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
