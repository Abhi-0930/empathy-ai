from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
import os
from chatbot_response import _encrypt_text, _decrypt_text, chat_collection


def _is_encrypted(value: str) -> bool:
    """
    Best-effort check: if decrypting returns something different, it's encrypted.
    If decryption fails, _decrypt_text returns as-is (plaintext), so we treat as plaintext.
    """
    if not value:
        return True
    try:
        decrypted = _decrypt_text(value)
        return decrypted != value
    except Exception:
        return False


def migrate_all_users():
    updated_docs = 0
    updated_entries = 0

    for doc in chat_collection.find({}):
        history = doc.get("chat_history", [])
        if not isinstance(history, list) or not history:
            continue

        changed = False
        new_history = []
        for entry in history:
            if not isinstance(entry, dict):
                new_history.append(entry)
                continue
            e = dict(entry)
            um = e.get("user_message", "")
            ar = e.get("ai_response", "")

            if isinstance(um, str) and um and not _is_encrypted(um):
                e["user_message"] = _encrypt_text(um)
                changed = True
                updated_entries += 1
            if isinstance(ar, str) and ar and not _is_encrypted(ar):
                e["ai_response"] = _encrypt_text(ar)
                changed = True
                updated_entries += 1

            new_history.append(e)

        if changed:
            chat_collection.update_one(
                {"_id": doc["_id"]},
                {"$set": {"chat_history": new_history, "encryptedAt": datetime.utcnow()}},
            )
            updated_docs += 1

    return updated_docs, updated_entries


if __name__ == "__main__":
    load_dotenv()
    docs, entries = migrate_all_users()
    print(f"Migration complete. Updated docs: {docs}, updated entries: {entries}")

