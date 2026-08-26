FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        curl \
        postgresql \
        postgresql-contrib \
        redis-server \
    && rm -rf /var/lib/apt/lists/*

USER ubuntu
