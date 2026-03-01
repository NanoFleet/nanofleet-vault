FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json ./
RUN bun install --frozen-lockfile

COPY . .

RUN mkdir -p /data

ARG VERSION=dev
LABEL com.nanofleet.version=${VERSION}

ENV NODE_ENV=production

EXPOSE 8822 8823

CMD ["bun", "run", "src/index.ts"]
