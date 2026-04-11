# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=app.py
ENV PORT=7860

# Install system dependencies for OpenCV, DeepFace, and Librosa
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Create the uploads directory and set permissions
RUN mkdir -p uploads && chmod 777 uploads

# Expose the port (Hugging Face uses 7860)
EXPOSE 7860

# Command to run the application
# We use 0.0.0.0 to allow external connections
CMD ["flask", "run", "--host=0.0.0.0", "--port=7860"]
