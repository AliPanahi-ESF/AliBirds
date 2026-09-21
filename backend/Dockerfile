FROM python:3.12-slim

# WeasyPrint system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libffi-dev \
    libgdk-pixbuf2.0-0 \
    libxml2 \
    libxslt1.1 \
    fonts-liberation \
    fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir -e .

COPY . .

# Create storage directories
RUN mkdir -p storage/invoices storage/receipts storage/mt940

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
