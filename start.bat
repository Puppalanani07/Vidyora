@echo off
cd /d "%~dp0"

call ".venv\Scripts\activate.bat"
if errorlevel 1 (
    echo Could not activate .venv. Create it with: py -m venv .venv
    pause
    exit /b 1
)

python -m pip install -q -r requirements.txt
if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
)

start "" "http://127.0.0.1:5000"
python app.py
