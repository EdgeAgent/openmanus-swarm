FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install OpenManus (try pip first, fall back to git)
RUN pip install --no-cache-dir openmanus || \
    (git clone https://github.com/FoundationAgents/OpenManus.git /tmp/openmanus && \
     cd /tmp/openmanus && pip install --no-cache-dir -e .)

WORKDIR /app

COPY run.sh /app/run.sh
RUN chmod +x /app/run.sh

ENTRYPOINT ["/app/run.sh"]
