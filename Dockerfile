# Cloud Run + Puppeteer (Chromium)
FROM node:22-bookworm-slim

# Chromium + fonts for headless screenshots
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    PORT=8080

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY . .

# Non-root (Cloud Run / Puppeteer sandbox-friendly)
RUN groupadd -r app && useradd -r -g app -G audio,video app \
  && mkdir -p /home/app \
  && chown -R app:app /app /home/app
USER app

EXPOSE 8080

CMD ["node", "server.js"]
