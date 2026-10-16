from datetime import timezone

from bson import ObjectId
from flask import Blueprint, jsonify
from pymongo.errors import PyMongoError

from app.database import (
    MongoConfigurationError,
    MongoUnavailableError,
    get_conversations_collection,
)


conversations_bp = Blueprint("conversations", __name__)


def _timestamp(value):
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _database_error_response(error):
    message = str(error)
    if isinstance(error, PyMongoError):
        message = "MongoDB is unavailable while loading conversations."
    return jsonify({"error": message}), 503


@conversations_bp.get("/conversations")
def list_conversations():
    try:
        collection = get_conversations_collection()
        documents = collection.find(
            {},
            {"messages": 0},
        ).sort("updated_at", -1).limit(50)
        conversations = [
            {
                "id": str(document["_id"]),
                "title": document["title"],
                "learning_level": document["learning_level"],
                "created_at": _timestamp(document["created_at"]),
                "updated_at": _timestamp(document["updated_at"]),
                "message_count": document["message_count"],
            }
            for document in documents
        ]
    except (MongoConfigurationError, MongoUnavailableError, PyMongoError) as exc:
        return _database_error_response(exc)

    return jsonify({"conversations": conversations})


@conversations_bp.get("/conversations/<conversation_id>")
def get_conversation(conversation_id):
    if not ObjectId.is_valid(conversation_id):
        return jsonify({"error": "conversation_id must be a valid MongoDB ObjectId."}), 400

    try:
        collection = get_conversations_collection()
        document = collection.find_one({"_id": ObjectId(conversation_id)})
    except (MongoConfigurationError, MongoUnavailableError, PyMongoError) as exc:
        return _database_error_response(exc)

    if document is None:
        return jsonify({"error": "Conversation not found."}), 404

    return jsonify(
        {
            "id": str(document["_id"]),
            "title": document["title"],
            "learning_level": document["learning_level"],
            "created_at": _timestamp(document["created_at"]),
            "updated_at": _timestamp(document["updated_at"]),
            "message_count": document["message_count"],
            "messages": [
                {
                    "role": message["role"],
                    "content": message["content"],
                    "learning_level": message["learning_level"],
                    "timestamp": _timestamp(message["timestamp"]),
                }
                for message in document["messages"]
            ],
        }
    )
