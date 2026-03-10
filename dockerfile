FROM python:3.12-slim

# Copy only the requirements first, to leverage Docker cache for dependencies
WORKDIR /app
COPY requirements.txt .

# Install dependencies (no-cache-dir reduces image size footprint)
RUN pip install --no-cache-dir -r requirements.txt

# Playwright requires its browser binaries and OS dependencies installed to work
RUN playwright install --with-deps chromium

# Copy the rest of the application code into the image container
COPY . .

# Finally, execute the backend app correctly as a python module from the working directory
CMD ["python3", "-m", "backend.app"]