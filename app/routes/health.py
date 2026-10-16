from flask import Blueprint, jsonify

from app.database import (
    MongoConfigurationError,
    MongoUnavailableError,
    check_mongodb_connection,
)
from pymongo.errors import PyMongoError


health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def health():
    try:
        check_mongodb_connection()
    except (MongoConfigurationError, MongoUnavailableError, PyMongoError):
        return jsonify(
            {
                "status": "degraded",
                "service": "Vidyora API",
                "mongodb": "disconnected",
            }
        ), 503

    return jsonify(
        {
            "status": "ok",
            "service": "Vidyora API",
            "mongodb": "connected",
        }
    )
