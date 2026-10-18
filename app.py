import logging
import os
from pathlib import Path
import sys
import traceback

from dotenv import load_dotenv
from groq import Groq
from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException
from flask_cors import CORS


load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env", override=True)

app = Flask(__name__)
CORS(app, origins=["http://127.0.0.1:5500", "http://localhost:5500"])

groq_api_key = os.getenv("GROQ_API_KEY")
client = Groq(api_key=groq_api_key) if groq_api_key else None
print("GROQ key loaded" if groq_api_key else "GROQ key MISSING", file=sys.stderr)


@app.errorhandler(HTTPException)
def handle_http_error(error):
    return jsonify({"error": error.description}), error.code


@app.errorhandler(Exception)
def handle_unexpected_error(error):
    app.logger.exception("Unexpected API error.", exc_info=error)
    return jsonify({"error": "An unexpected server error occurred."}), 500


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/chat", methods=["POST", "OPTIONS"])
def chat():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"})

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
            raise RuntimeError("GROQ_API_KEY is missing. Add it to the project .env file.")

        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
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
    except Exception as e:
        app.logger.exception("Unexpected error while processing a chat request.")
        traceback.print_exc()
        return jsonify({"error": f"{type(e).__name__}: {e}"}), 500


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    app.run(host="127.0.0.1", port=5000, debug=True)
