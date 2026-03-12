import os

from sentiment_analysis import analyze_sentiment
from face_emotion import analyze_facial_emotion
from voice_emotion import analyze_voice_emotion

from langchain_openai.chat_models.base import ChatOpenAI
from langchain.schema import SystemMessage, HumanMessage
from dotenv import load_dotenv
import os

from langchain.memory import ConversationBufferMemory

from pymongo import MongoClient
from datetime import datetime, timedelta

# TODO: move this URI to environment variables
MONGO_URI = "mongodb+srv://abhishekj3094_db_user:Abhi._.3094@cluster0.qigdlpm.mongodb.net/userschats"
client = MongoClient(MONGO_URI)
db = client["visionava_users"]
chat_collection = db["users_chat"]


def store_chat_in_db(user_id, session_id, user_text, ai_response, voice_emotion, dominant_emotion):
    """Store user and AI messages in the database, grouped by session."""
    chat_entry = {
        "timestamp": datetime.utcnow(),
        "user_message": user_text,
        "ai_response": ai_response,
        "voice_emotion": voice_emotion,
        "dominant_emotion": dominant_emotion,
    }

    existing_chat = chat_collection.find_one(
        {"user_id": user_id, "session_id": session_id}
    )

    if existing_chat:
        chat_collection.update_one(
            {"_id": existing_chat["_id"]},
            {"$push": {"chat_history": chat_entry}},
        )
    else:
        chat_collection.insert_one(
            {
                "user_id": user_id,
                "session_id": session_id,
                "chat_history": [chat_entry],
            }
        )


def get_chat_history_from_db(user_id, session_id):
    """Retrieve chat history for a specific user and session.

    If user_id is None, fall back to session_id-only lookup (for shared views).
    """
    query = {"session_id": session_id}
    if user_id is not None:
        query["user_id"] = user_id

    existing_chat = chat_collection.find_one(query)
    if existing_chat:
        return existing_chat.get("chat_history", [])

    return []
    # chat_history = chat_collection.find({"user_id": user_id}).sort("timestamp", 1)
    # return [{"user": entry["user_message"], "ai": entry["ai_response"]} for entry in chat_history]

load_dotenv()
openai_api_key = os.getenv("OPENAI_API_KEY")
# Slightly higher temperature for more varied, less repetitive responses
llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0.8)

# Create memory for storing chat history (not currently used directly)
memory = ConversationBufferMemory()

def determine_dominant_emotion(text_sentiment, voice_emotion, face_emotion):
    """
    Determines the most likely dominant emotion based on text, voice, and face.
    Priority: Voice > Text > Face (with conflict resolution).
    """
    
    if voice_emotion == text_sentiment:
        return voice_emotion


    if text_sentiment == face_emotion and voice_emotion != text_sentiment:
        return voice_emotion


    if voice_emotion == face_emotion and text_sentiment != voice_emotion:
        return voice_emotion  # Voice + Face = strongest evidence

    return voice_emotion or text_sentiment or face_emotion


def get_mood_trends_for_user(user_id: str, days: int = 7):
    """
    Aggregate per-day emotion stats for a given user over the last `days`.

    Returns a dict with:
    - buckets: [{ date: 'YYYY-MM-DD', dominant_emotion: str | None, counts: { emotion: count } }]
    - totals: { emotion: total_count_over_range }
    """
    if not user_id:
        return {"buckets": [], "totals": {}}

    now = datetime.utcnow()
    since = now - timedelta(days=days)

    # Aggregate across all sessions for this user
    cursor = chat_collection.find({"user_id": user_id})

    per_day = {}
    totals = {}

    for doc in cursor:
        history = doc.get("chat_history", [])
        for entry in history:
            ts = entry.get("timestamp")
            dominant = entry.get("dominant_emotion")
            if not ts or not dominant:
                continue
            # Ensure datetime
            if isinstance(ts, str):
                try:
                    ts = datetime.fromisoformat(ts)
                except Exception:
                    continue
            if ts < since:
                continue

            date_key = ts.date().isoformat()
            if date_key not in per_day:
                per_day[date_key] = {}
            per_day[date_key][dominant] = per_day[date_key].get(dominant, 0) + 1

            totals[dominant] = totals.get(dominant, 0) + 1

    # Build sorted buckets
    buckets = []
    for date_key in sorted(per_day.keys()):
        counts = per_day[date_key]
        # Pick the emotion with the highest count for that day
        dominant_for_day = (
            max(counts.items(), key=lambda kv: kv[1])[0] if counts else None
        )
        buckets.append(
            {
                "date": date_key,
                "dominant_emotion": dominant_for_day,
                "counts": counts,
            }
        )

    return {"buckets": buckets, "totals": totals}


def _generate_conversational_response(user_id, session_id, user_text, formatted_history):
    """Normal back-and-forth chat for text-only mode (no emotion-analysis structure)."""
    system_message = SystemMessage(
        content=(
            "You are a warm, supportive **mental health** AI companion. Your role is to support users with their emotional well-being, stress, and mental health—not to answer general knowledge, coding, tech, or other off-topic questions.\n\n"
            "Reply in a natural, conversational way. Keep responses concise. Use **bold** or markdown only when it helps.\n\n"
            "**If the user asks about mental health, feelings, stress, or how they're doing:** Respond with empathy and support. Match their tone—brief for brief messages, more depth when they open up. No fixed sections or long templates.\n\n"
            "**If the user asks about something off-topic (e.g. coding, tech, general knowledge, homework, other topics):** Do not answer the question in full. Briefly acknowledge it in one sentence, then gently redirect. For example: \"I'm here to support you with how you're feeling and your well-being—I'm not the best for tech or coding questions. How have you been feeling lately, or is there something on your mind?\" Keep it kind and short, then invite them to share what's on their mind emotionally or mentally.\n\n"
            "Stay in character as a mental health companion. Do not provide detailed answers to non–mental-health topics."
        )
    )
    user_message = HumanMessage(content=user_text)
    messages = formatted_history + [system_message, user_message]
    ai_response = llm.invoke(messages)
    store_chat_in_db(
        user_id,
        session_id,
        user_text,
        ai_response.content,
        voice_emotion=None,
        dominant_emotion=None,
    )
    return ai_response.content


def generate_chatbot_response(user_id, session_id, user_text, face_emotion, voice_emotion, voice_text):
    """Generate chatbot response. Text-only = normal conversation; voice/face = emotion-structured response."""

    # Fallback: if no session_id provided, group by user_id
    if not session_id:
        session_id = user_id

    # Retrieve previous conversation history for this session from MongoDB Atlas
    chat_history = get_chat_history_from_db(user_id, session_id)

    # Convert chat history into LangChain-compatible format
    formatted_history = []
    for entry in chat_history:
        formatted_history.append(HumanMessage(content=entry["user_message"]))
        formatted_history.append(SystemMessage(content=entry["ai_response"]))

    # Text-only (no voice, no face) → normal conversational chat
    if not voice_emotion and not face_emotion:
        return _generate_conversational_response(
            user_id, session_id, user_text, formatted_history
        )

    # Voice and/or face present → emotion-analysis flow with structured response
    sentiment, confidence = analyze_sentiment(user_text)
    dominant_emotion = determine_dominant_emotion(sentiment, voice_emotion, face_emotion)

    # Collect the last few AI responses so the model can avoid repeating itself
    recent_ai_responses = [
        entry.get("ai_response", "")
        for entry in chat_history[-3:]
        if entry.get("ai_response")
    ]

    # Count how many previous turns in this session had the same dominant emotion
    same_emotion_count = sum(
        1 for entry in chat_history if entry.get("dominant_emotion") == dominant_emotion
    )

    if voice_emotion and face_emotion and voice_emotion != face_emotion:
        mixed_emotion_prompt = (
            f"The user’s voice suggests {voice_emotion}, but their face appears {face_emotion}. "
            "They might be masking their true emotions. Respond gently and encourage them to express how they truly feel."
        )
    else:
        mixed_emotion_prompt = f"The user feels {dominant_emotion}. Respond appropriately."


    system_message = SystemMessage(
        content=(
            "You are a compassionate AI mental health therapist, dedicated to helping users feel heard, understood, and supported. "
            "Your goal is to first recognize and acknowledge their emotions with empathy before offering any solutions. "
            "Avoid generic responses—each reply must be personalized to the user’s current emotional state.\n\n"
            "Always respond in **GitHub‑flavoured markdown** so it renders nicely in a chat UI.\n\n"
            "Use this structure, with clear headings and bullet points (each bullet on its own line):\n\n"
            "### Emotional reflection\n"
            "- 1–2 short bullets summarizing what the user seems to be feeling.\n\n"
            "### What this might feel like\n"
            "- 2–4 bullets validating their experience in everyday language.\n\n"
            "### Therapy suggestions\n"
            "- 3–5 specific, actionable suggestions.\n"
            "- Include items like **Deep breathing**, **Grounding exercise**, **Positive distraction**, or journaling when appropriate.\n\n"
            "### Gentle reminder\n"
            "- 1–2 short bullets reminding them they are not alone and encouraging self‑care.\n\n"
            "Keep paragraphs short, use bullet lists instead of long blocks of text, and use **bold** for key phrases or section titles."
        )
    )

    previous_reply_block = (
        "\n\nHere are your last replies in this session. "
        "Use them only as context; **do NOT repeat the same sentences, bullet points, or examples verbatim**. "
        "Introduce at least one or two *new* techniques or perspectives:\n\n"
        + "\n\n---\n\n".join(recent_ai_responses)
        if recent_ai_responses
        else ""
    )

    if same_emotion_count <= 1:
        # Full, structured response (good for first 1–2 times with this emotion)
        user_message = HumanMessage(
            content=(
                f"The user is currently feeling **{dominant_emotion}**. They said: \"{user_text}\".\n\n"
                "Using the markdown structure described above, write a response that:\n"
                "- Acknowledges their emotions with empathy before offering any solutions.\n"
                "- Provides emotional support and helps them feel understood.\n"
                "- Suggests 3–5 concrete therapy techniques (breathing, mindfulness, grounding, journaling, positive activities, etc.).\n"
                "- Recommends activities/tasks that match their emotions.\n"
                "- Ends with a warm, reassuring reminder that they are not alone.\n\n"
                "Very important:\n"
                "- Vary your wording and examples from previous replies.\n"
                "- Avoid copying entire sentences or bullet points you’ve already used in this session.\n"
                "- Include at least 1–2 suggestions that are *new* compared to earlier messages.\n"
                "- You may briefly reuse an idea (like gratitude or breathing), but phrase it differently or add a fresh angle.\n"
                "Do not add extra sections beyond the four headings, and do not include disclaimers unless safety is a concern."
                f"{previous_reply_block}"
            )
        )
    else:
        # Follow-up mode: shorter, more conversational, with questions and new angles
        user_message = HumanMessage(
            content=(
                f"The user is again currently feeling **{dominant_emotion}**. They said: \"{user_text}\".\n\n"
                "They have already received 2 or more full responses for this emotion in this session.\n\n"
                "Using the same four markdown headings, write a **shorter follow-up style** response:\n"
                "- Under **Emotional reflection**: 1–2 very short bullets.\n"
                "- Under **What this might feel like**: 1–2 bullets, ideally connecting to patterns over time.\n"
                "- Under **Therapy suggestions**: 2–3 suggestions that add *new* angles (e.g., long-term habits, reflecting on patterns, setting small goals), not just repeating gratitude / breathing.\n"
                "- Under **Gentle reminder**: 1–2 bullets, plus 1–2 open questions inviting them to share more (e.g., what’s been going well, anything they’d like to explore deeper).\n\n"
                "Keep the whole reply shorter than your usual full response.\n"
                "Do NOT repeat entire sentences or bullet points from earlier replies in this session.\n"
                "You may reuse ideas but with clearly different phrasing and at least one fresh perspective.\n"
                f"{previous_reply_block}"
            )
        )





    
    messages = formatted_history + [system_message, user_message]

    ai_response = llm.invoke(messages)

    # Store the chat history in MongoDB Atlas under users_chat collection
    store_chat_in_db(
        user_id,
        session_id,
        user_text,
        ai_response.content,
        voice_emotion,
        dominant_emotion,
    )
    return ai_response.content


