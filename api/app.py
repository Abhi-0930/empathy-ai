from dotenv import load_dotenv
load_dotenv()


from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from functools import wraps
import time
import uuid

from sentiment_analysis import analyze_sentiment
from face_emotion import analyze_facial_emotion

from chatbot_response import (
    generate_chatbot_response,
    get_mood_trends_for_user,
    get_personalization_summary_for_user,
)
import os

from voice_emotion import analyze_voice_emotion
from utils import transcribe_voice

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", 10 * 1024 * 1024))
ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
ALLOWED_AUDIO_EXTENSIONS = {"wav", "mp3", "m4a", "ogg", "webm"}
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

MODEL_TIMEOUT_SECONDS = float(os.getenv("MODEL_TIMEOUT_SECONDS", "12"))
TRANSCRIPTION_TIMEOUT_SECONDS = float(os.getenv("TRANSCRIPTION_TIMEOUT_SECONDS", "20"))
EXECUTOR = ThreadPoolExecutor(max_workers=int(os.getenv("MODEL_EXECUTOR_WORKERS", "4")))

app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

CORS(
    app,
    resources={r"/*": {"origins": ALLOWED_ORIGINS}},
)

_request_counts = defaultdict(int)
_request_latency_sum_ms = defaultdict(float)
_rate_limit_windows = defaultdict(deque)


def _rate_limit(max_requests: int, window_seconds: int):
    def decorator(func):
        @wraps(func)
        def wrapped(*args, **kwargs):
            key = f"{request.remote_addr}:{request.endpoint}"
            now = time.time()
            dq = _rate_limit_windows[key]
            while dq and dq[0] <= now - window_seconds:
                dq.popleft()
            if len(dq) >= max_requests:
                return jsonify({"error": "Too many requests. Please try again shortly."}), 429
            dq.append(now)
            return func(*args, **kwargs)

        return wrapped

    return decorator


def _run_with_timeout(callable_obj, timeout_seconds, fallback=None):
    future = EXECUTOR.submit(callable_obj)
    try:
        return future.result(timeout=timeout_seconds)
    except TimeoutError:
        return fallback
    except Exception:
        return fallback


def _allowed_extension(filename: str, allowed_set: set):
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in allowed_set


def _save_upload(file_storage, allowed_set: set):
    filename = secure_filename(file_storage.filename or "")
    if not filename or not _allowed_extension(filename, allowed_set):
        raise ValueError("Unsupported file type")

    unique_name = f"{uuid.uuid4().hex}_{filename}"
    file_path = os.path.join(app.config["UPLOAD_FOLDER"], unique_name)
    file_storage.save(file_path)
    return file_path


@app.before_request
def _before_request_metrics():
    request._start_time = time.time()


@app.after_request
def _after_request_metrics(response):
    start = getattr(request, "_start_time", time.time())
    duration_ms = (time.time() - start) * 1000
    endpoint = request.endpoint or request.path
    _request_counts[endpoint] += 1
    _request_latency_sum_ms[endpoint] += duration_ms

    print(f"[api] {request.method} {request.path} -> {response.status_code} ({duration_ms:.2f}ms)")
    return response

# Optional one-time migration: encrypt existing plaintext chat messages.
try:
    if os.getenv("MIGRATE_EXISTING_CHATS_ON_STARTUP", "").lower() in ("1", "true", "yes"):
        from migrate_encrypt_chats import migrate_all_users

        migrate_all_users()
except Exception:
    # Never block server start due to migration issues
    pass

@app.route('/analyze_statement', methods=["POST"])
@_rate_limit(max_requests=int(os.getenv("ML_RATE_LIMIT_MAX", "120")), window_seconds=int(os.getenv("ML_RATE_LIMIT_WINDOW_SECONDS", "60")))
def analyze_statement():
    """
    Analyze the sentiment of the given text using roberta sentiment model
    """
    data = request.get_json()
    text = data.get("text", "")

    if not text:
        return jsonify({"error": "No text provided"}), 400
    
    result = _run_with_timeout(
        lambda: analyze_sentiment(text),
        MODEL_TIMEOUT_SECONDS,
        fallback=("Neutral", 0.0),
    )

    return jsonify(result)

@app.route('/analyze_face', methods=["POST"])
@_rate_limit(max_requests=int(os.getenv("ML_RATE_LIMIT_MAX", "120")), window_seconds=int(os.getenv("ML_RATE_LIMIT_WINDOW_SECONDS", "60")))
def analyze_face():
    """
    Analyze facial emotion from an uploaded image file.
    """
    if "files" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['files']
    try:
        file_path = _save_upload(file, ALLOWED_IMAGE_EXTENSIONS)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    emotion = _run_with_timeout(
        lambda: analyze_facial_emotion(file_path),
        MODEL_TIMEOUT_SECONDS,
        fallback="Neutral",
    )
    
    return jsonify({"emotion": emotion})

@app.route('/unified_emotion', methods=['POST'])
@_rate_limit(max_requests=int(os.getenv("ML_RATE_LIMIT_MAX", "120")), window_seconds=int(os.getenv("ML_RATE_LIMIT_WINDOW_SECONDS", "60")))
def unified_emotion():
    """
    Analyzes both face emotion, text sentiment and voice tone
    """
    user_id = request.form.get("user_id", None)
    session_id = request.form.get("session_id", None)
    user_text = request.form.get("text", "")
    face_file = request.files.get("face")
    voice_file = request.files.get("voice")

    voice_text=None

    face_emotion = None
    voice_emotion = None

    if not user_text and not face_file and not voice_file:
        return jsonify({"error": "Provide text or face/voice input"}), 400

    if face_file:
        try:
            file_path = _save_upload(face_file, ALLOWED_IMAGE_EXTENSIONS)
            face_emotion = _run_with_timeout(
                lambda: analyze_facial_emotion(file_path),
                MODEL_TIMEOUT_SECONDS,
                fallback="Neutral",
            )
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    if voice_file:
        try:
            voice_path = _save_upload(voice_file, ALLOWED_AUDIO_EXTENSIONS)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        voice_emotion = _run_with_timeout(
            lambda: analyze_voice_emotion(voice_path),
            MODEL_TIMEOUT_SECONDS,
            fallback="Neutral",
        )
        try:
            voice_text = _run_with_timeout(
                lambda: transcribe_voice(voice_path),
                TRANSCRIPTION_TIMEOUT_SECONDS,
                fallback=None,
            )
        except Exception:
            # Do not surface low-level transcription errors as user text;
            # fall back to text-only / voice-emotion-only handling.
            voice_text = None

    if not user_text and voice_text:
        user_text = voice_text

    # Require user_id, but allow session_id to be optional.
    # If session_id is missing, fall back to a default per-user session.
    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400

    if not session_id:
        session_id = user_id  # fallback: one session per user

    chatbot_response = generate_chatbot_response(
        user_id, session_id, user_text, face_emotion, voice_emotion, voice_text
    )

    return jsonify({
        "user_text": user_text,  # ✅ Final text used (either typed or transcribed)
        "text_sentiment": _run_with_timeout(
            lambda: analyze_sentiment(user_text)[0],
            MODEL_TIMEOUT_SECONDS,
            fallback="Neutral",
        ),
        "face_emotion": face_emotion,
        "voice_emotion": voice_emotion,
        "voice_text": voice_text,  # ✅ Include transcribed voice text for debugging
        "chatbot_response": chatbot_response
    })


@app.route('/sessions/<session_id>/history', methods=['GET'])
def get_session_history(session_id):
    """
    Return full chat history for a given session scoped to a user.
    """
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400

    from chatbot_response import get_chat_history_from_db  # local import to avoid circular

    history = get_chat_history_from_db(user_id, session_id)

    messages = []
    for entry in history:
        ts = entry.get("timestamp")
        messages.append(
            {
                "timestamp": ts.isoformat() if ts else None,
                "user_message": entry.get("user_message", ""),
                "ai_response": entry.get("ai_response", ""),
                "voice_emotion": entry.get("voice_emotion"),
            }
        )

    return jsonify({"session_id": session_id, "messages": messages})


@app.route('/users/<user_id>/personalization-summary', methods=['GET'])
def personalization_summary(user_id):
    """
    Return a compact personalization summary for a user.
    """
    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400

    summary = get_personalization_summary_for_user(user_id)
    return jsonify(summary)

@app.route('/analyze_voice', methods=['POST'])
@_rate_limit(max_requests=int(os.getenv("ML_RATE_LIMIT_MAX", "120")), window_seconds=int(os.getenv("ML_RATE_LIMIT_WINDOW_SECONDS", "60")))
def analyze_voice():
    """
    Analyze voice tone from an uploaded audio file.
    """
    if "file" not in request.files:
        return jsonify({"error": "No audio file uploaded"}), 400
    
    file = request.files["file"]
    try:
        file_path = _save_upload(file, ALLOWED_AUDIO_EXTENSIONS)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    voice_emotion = _run_with_timeout(
        lambda: analyze_voice_emotion(file_path),
        MODEL_TIMEOUT_SECONDS,
        fallback="Neutral",
    )

    return jsonify({"voice_emotion": voice_emotion})


@app.route('/mood-trends', methods=['GET'])
def mood_trends():
    """
    Aggregate mood trends for a user over a time range.

    Query params:
    - user_id: required
    - range: optional, one of '7d', '30d', '90d' (default '7d')
    """
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400

    range_param = request.args.get("range", "7d")
    range_map = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
    }
    days = range_map.get(range_param, 7)

    trends = get_mood_trends_for_user(user_id=user_id, days=days)

    return jsonify(
        {
            "user_id": user_id,
            "range": range_param,
            "days": days,
            "buckets": trends.get("buckets", []),
            "totals": trends.get("totals", {}),
        }
    )


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify(
        {
            "status": "ok",
            "service": "api",
            "timestamp": time.time(),
        }
    ), 200


@app.route('/metrics', methods=['GET'])
def metrics():
    avg_latency = {}
    for endpoint, count in _request_counts.items():
        total = _request_latency_sum_ms.get(endpoint, 0.0)
        avg_latency[endpoint] = round(total / count, 2) if count else 0.0

    return jsonify(
        {
            "request_count_by_endpoint": dict(_request_counts),
            "average_latency_ms_by_endpoint": avg_latency,
        }
    )

if __name__ == "__main__":
    # Use 5001 to avoid Windows port 5000 reservation / permission issues
    app.run(debug=True, port=5001)

    