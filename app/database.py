import os
from threading import Lock

from flask import current_app
from pymongo import MongoClient
from pymongo.errors import ConfigurationError, PyMongoError


_client_lock = Lock()


class MongoConfigurationError(Exception):
    pass


class MongoUnavailableError(Exception):
    pass


def get_database():
    uri = os.getenv("MONGODB_URI")
    database_name = os.getenv("MONGODB_DATABASE")
    if not uri or not database_name:
        raise MongoConfigurationError(
            "Set MONGODB_URI and MONGODB_DATABASE in the backend .env file."
        )

    client = current_app.extensions.get("mongo_client")
    if client is None:
        with _client_lock:
            client = current_app.extensions.get("mongo_client")
            if client is None:
                try:
                    client = MongoClient(uri)
                except (ConfigurationError, PyMongoError, ValueError) as exc:
                    raise MongoConfigurationError(
                        "MongoDB settings are invalid. Check MONGODB_URI and "
                        "MONGODB_DATABASE in the backend .env file."
                    ) from exc
                current_app.extensions["mongo_client"] = client

    try:
        return client[database_name]
    except (ConfigurationError, ValueError) as exc:
        raise MongoConfigurationError(
            "MONGODB_DATABASE is invalid. Check the backend .env file."
        ) from exc


def get_conversations_collection():
    return get_database()["conversations"]


def check_mongodb_connection():
    database = get_database()
    try:
        database.client.admin.command("ping")
    except PyMongoError as exc:
        raise MongoUnavailableError(
            "Could not connect to MongoDB. Confirm the local MongoDB server is running "
            "and MONGODB_URI is correct."
        ) from exc
