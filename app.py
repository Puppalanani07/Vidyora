import os
from pathlib import Path
import traceback

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from groq import (
    APIConnectionError,
    APITimeoutError,
    AuthenticationError,
    Groq,
    RateLimitError,
)
from werkzeug.exceptions import HTTPException


PROJECT_ROOT = Path(__file__).resolve().parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"

load_dotenv(dotenv_path=PROJECT_ROOT / ".env", override=True)

app = Flask(
    __name__,
    static_folder=str(FRONTEND_DIR),
    static_url_path="/frontend",
)
CORS(
    app,
    origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "https://vidyora-ochre.vercel.app",
    ],
)

groq_api_key = os.environ.get("GROQ_API_KEY")
client = (
    Groq(api_key=groq_api_key, timeout=25.0, max_retries=0)
    if groq_api_key
    else None
)
print("GROQ key loaded" if groq_api_key else "GROQ key MISSING")

from app.routes.conversations import conversations_bp

app.register_blueprint(conversations_bp, url_prefix="/api")


@app.errorhandler(HTTPException)
def handle_http_error(error):
    return jsonify({"error": error.description}), error.code


@app.errorhandler(Exception)
def handle_unexpected_error(error):
    traceback.print_exc()
    return jsonify({"error": "An unexpected server error occurred."}), 500


@app.get("/")
def index():
    return jsonify({"status": "Vidyora API is running"})


@app.get("/health")
def health():
    return jsonify({"ok": True})


@app.post("/chat")
def chat():
    try:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"error": "Request body must be a JSON object."}), 400

        message = data.get("message")
        if not isinstance(message, str) or not message.strip():
            return jsonify({"error": "Message cannot be empty."}), 400

        level = data.get("level", "Beginner")
        if not isinstance(level, str) or not level.strip():
            return jsonify({"error": "Level must be a non-empty string."}), 400

        if client is None:
            return jsonify({
                "error": "Groq is not configured. Set the GROQ_API_KEY environment variable."
            }), 503

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are Vidyora, a friendly tutor. Explain at {level.strip()} "
                        "level in simple words."
                    ),
                },
                {"role": "user", "content": message.strip()},
            ],
        )
        reply = response.choices[0].message.content
        if not reply:
            raise RuntimeError("Groq returned an empty response.")

        return jsonify({"reply": reply.strip()})
    except AuthenticationError:
        traceback.print_exc()
        return jsonify({
            "error": "Invalid Groq API key. Check GROQ_API_KEY in the deployment environment."
        }), 401
    except RateLimitError:
        traceback.print_exc()
        return jsonify({"error": "Too many requests, try again in a minute"}), 429
    except APITimeoutError:
        traceback.print_exc()
        return jsonify({"error": "The request timed out. Please try again."}), 504
    except (APIConnectionError, ConnectionError):
        traceback.print_exc()
        return jsonify({"error": "Could not connect to Groq. Check your internet connection and try again."}), 502
    except TimeoutError:
        traceback.print_exc()
        return jsonify({"error": "The request timed out. Please try again."}), 504
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"{type(e).__name__}: {e}"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
