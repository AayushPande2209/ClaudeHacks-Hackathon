# Python backend for TariffShield
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ ./src/

# Set environment variables
ENV PYTHONPATH=/app/src
ENV APP_DEFAULT_USER_ID=00000000-0000-0000-0000-000000000001
ENV PORT=8080

EXPOSE 8080

# Run the API
CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8080"]
