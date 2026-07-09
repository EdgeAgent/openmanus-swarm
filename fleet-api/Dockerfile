FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY fleet_api.py .

EXPOSE 8800

CMD ["uvicorn", "fleet_api:app", "--host", "0.0.0.0", "--port", "8800"]
