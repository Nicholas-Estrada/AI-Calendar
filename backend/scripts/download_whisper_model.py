import os
from pathlib import Path

from faster_whisper.utils import download_model

backend_root = Path(__file__).resolve().parents[1]
model_name = os.environ.get("LIAS_WHISPER_MODEL", "tiny.en")
model_path = Path(
    os.environ.get(
        "LIAS_WHISPER_MODEL_PATH",
        backend_root / "data" / "models" / "faster-whisper-tiny.en",
    )
).resolve()

model_path.parent.mkdir(parents=True, exist_ok=True)
print(f"Downloading the local {model_name} speech model to {model_path}...")
download_model(model_name, output_dir=str(model_path))
print("Local speech model is ready.")
