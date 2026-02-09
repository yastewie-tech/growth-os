FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
EXPOSE 8080

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/dist/public ./dist/public

CMD ["npm", "run", "start"]
