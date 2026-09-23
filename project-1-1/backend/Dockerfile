FROM node:24-bookworm-slim AS node
FROM python:3.12-slim-bookworm
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN pip install --no-cache-dir 'coworker @ git+https://github.com/mrvgao/openworker.git@30d6e9a0144868caf37e780d70003f03ff520a87'
COPY erp/package*.json /app/erp/
RUN cd /app/erp && npm ci --omit=dev
COPY erp /app/erp
COPY app.py /app/app.py
COPY access.py /app/access.py
RUN useradd --uid 10001 --create-home agent && mkdir -p /var/data/agent && chown -R agent:agent /var/data /app
USER agent
ENV PYTHONUNBUFFERED=1 AGENT_DATA_DIR=/var/data/agent
CMD ["sh","-c","exec uvicorn app:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1 --no-access-log"]
