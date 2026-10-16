from pathlib import Path

from dotenv import load_dotenv
from flask import Flask
from flask import send_from_directory
from flask_cors import CORS

from app.routes.chat import chat_bp
from app.routes.conversations import conversations_bp
from app.routes.health import health_bp


def create_app():
    project_root = Path(__file__).resolve().parent.parent
    load_dotenv(project_root / ".env")

    frontend_dir = project_root / "frontend"
    app = Flask(
        __name__,
        static_folder=str(frontend_dir),
        static_url_path="/frontend",
    )
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": [r"^http://(localhost|127\.0\.0\.1)(:\d+)?$"]
            }
        },
    )
    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(chat_bp, url_prefix="/api")
    app.register_blueprint(conversations_bp, url_prefix="/api")

    @app.get("/")
    def index():
        return send_from_directory(frontend_dir, "index.html")

    return app
