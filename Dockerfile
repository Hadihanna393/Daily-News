# Daily Digest has no dependencies, so this is about as small as a Node image gets.
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json ./
COPY server ./server
COPY public ./public
COPY scripts ./scripts

# Snapshots live here. Mount a volume at this path to keep the day-by-day
# archive across restarts; without one the app still works, it just starts each
# deploy with an empty archive.
ENV DIGEST_DATA_DIR=/data
RUN mkdir -p /data

EXPOSE 4173
ENV PORT=4173

# The scheduler reads wall-clock time in this zone, so it does not matter what
# the host's own clock is set to.
ENV BRIEF_TZ=Asia/Jerusalem

HEALTHCHECK --interval=60s --timeout=10s --start-period=40s \
  CMD wget -qO- http://127.0.0.1:4173/api/health || exit 1

CMD ["node", "server/index.js"]
