from datetime import datetime, timezone
import os

import httpx
from bson import ObjectId
from flask import Blueprint, jsonify, request
from google import genai
from google.genai.errors import APIError
from google.genai.types import HttpOptions
from pymongo import ReturnDocument
from pymongo.errors import PyMongoError

from app.database import (
    MongoConfigurationError,
    MongoUnavailableError,
    check_mongodb_connection,
    get_conversations_collection,
)


chat_bp = Blueprint("chat", __name__)
GEMINI_TIMEOUT_MS = 30_000
LEARNING_LEVELS = {"beginner", "intermediate", "advanced"}


@chat_bp.post("/chat")
def chat():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    message = data.get("message")
    if not isinstance(message, str) or not message.strip():
        return jsonify({"error": "The 'message' field must be a non-empty string."}), 400

    learning_level = data.get("learning_level", "beginner")
    if not isinstance(learning_level, str) or learning_level.lower() not in LEARNING_LEVELS:
        return jsonify({
            "error": "The 'learning_level' field must be beginner, intermediate, or advanced."
        }), 400
    learning_level = learning_level.lower()

    conversation_id = data.get("conversation_id")
    if conversation_id is not None and (
        not isinstance(conversation_id, str) or not ObjectId.is_valid(conversation_id)
    ):
        return jsonify({"error": "'conversation_id' must be a valid conversation ID."}), 400

    try:
        check_mongodb_connection()
        conversations = get_conversations_collection()
        existing_conversation = None
        if conversation_id is not None:
            existing_conversation = conversations.find_one(
                {"_id": ObjectId(conversation_id)},
                {"_id": 1},
            )
            if existing_conversation is None:
                return jsonify({"error": "Conversation not found."}), 404
    except (MongoConfigurationError, MongoUnavailableError):
        return jsonify({
            "error": "MongoDB is unavailable. Check MONGODB_URI, MONGODB_DATABASE, and that the local server is running."
        }), 503
    except PyMongoError:
        return jsonify({"error": "MongoDB is unavailable while preparing the conversation."}), 503

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return jsonify({"error": "Gemini is not configured. Set GEMINI_API_KEY in the backend .env file."}), 503

    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    prompt = (
        f"Explain the answer at a {learning_level} learning level. "
        f"Answer the learner's question clearly:\n\n{message.strip()}"
    )

    try:
        client = genai.Client(
            api_key=api_key,
            http_options=HttpOptions(timeout=GEMINI_TIMEOUT_MS),
        )
        response = client.models.generate_content(model=model, contents=prompt)
    except httpx.TimeoutException:
        return jsonify({"error": "The Gemini request timed out. Please try again."}), 504
    except (APIError, httpx.RequestError):
        return jsonify({"error": "The Gemini API request failed. Please try again later."}), 502

    reply = response.text
    if not reply or not reply.strip():
        return jsonify({"error": "Gemini returned an empty response. Please try again."}), 502

    now = datetime.now(timezone.utc)
    assistant_timestamp = datetime.now(timezone.utc)
    user_message = {
        "role": "user",
        "content": message.strip(),
        "learning_level": learning_level,
        "timestamp": now,
    }
    assistant_message = {
        "role": "assistant",
        "content": reply,
        "learning_level": learning_level,
        "timestamp": assistant_timestamp,
    }

    try:
        if conversation_id is None:
            document = {
                "title": message.strip()[:80],
                "learning_level": learning_level,
                "created_at": now,
                "updated_at": assistant_timestamp,
                "message_count": 2,
                "messages": [user_message, assistant_message],
            }
            result = conversations.insert_one(document)
            conversation_id = str(result.inserted_id)
        else:
            result = conversations.find_one_and_update(
                {"_id": ObjectId(conversation_id)},
                {
                    "$push": {
                        "messages": {
                            "$each": [user_message, assistant_message],
                        }
                    },
                    "$set": {
                        "learning_level": learning_level,
                        "updated_at": assistant_timestamp,
                    },
                    "$inc": {"message_count": 2},
                },
                return_document=ReturnDocument.AFTER,
                projection={"_id": 1},
            )
            if result is None:
                return jsonify({"error": "Conversation not found."}), 404
    except PyMongoError:
        return jsonify({
            "error": "Gemini generated a reply, but MongoDB could not save the conversation."
        }), 503

    return jsonify({"reply": reply, "conversation_id": conversation_id})
