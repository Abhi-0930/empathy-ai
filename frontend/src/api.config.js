/**
 * Centralized API Configuration
 * These values are replaced by Environment Variables during build (Vite).
 * VITE_BACKEND_URL: The URL of your Node.js backend (on Render).
 * VITE_PYTHON_API_URL: The URL of your Python AI API (on Render/HuggingFace).
 */

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
export const PYTHON_API_URL = import.meta.env.VITE_PYTHON_API_URL || "http://127.0.0.1:5001";
