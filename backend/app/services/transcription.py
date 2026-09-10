from functools import lru_cache
from io import BytesIO
from pathlib import Path

from faster_whisper import WhisperModel

from app.config import Settings


class TranscriptionUnavailableError(RuntimeError):
    pass


@lru_cache(maxsize=2)
def _load_model(
    model_path: str,
    device: str,
    compute_type: str,
) -> WhisperModel:
    path = Path(model_path)
    if not path.is_dir():
        raise TranscriptionUnavailableError(
            "The local speech model is not installed. Run "
            "`cd backend && uv run python scripts/download_whisper_model.py` once."
        )

    try:
        return WhisperModel(
            str(path),
            device=device,
            compute_type=compute_type,
            local_files_only=True,
        )
    except (RuntimeError, ValueError) as error:
        raise TranscriptionUnavailableError(
            "The local speech model could not be loaded. Re-run the Whisper model setup command."
        ) from error


class LocalTranscriber:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def transcribe(self, audio: bytes) -> str:
        model = _load_model(
            str(self.settings.whisper_model_path.resolve()),
            self.settings.whisper_device,
            self.settings.whisper_compute_type,
        )
        try:
            segments, _ = model.transcribe(
                BytesIO(audio),
                language="en",
                beam_size=1,
                condition_on_previous_text=False,
            )
            text = " ".join(segment.text.strip() for segment in segments).strip()
        except (RuntimeError, ValueError) as error:
            raise TranscriptionUnavailableError(
                "The recording could not be decoded or transcribed locally."
            ) from error

        if not text:
            raise TranscriptionUnavailableError(
                "No speech was detected in the recording. "
                "Please try again closer to the microphone."
            )
        return text


def get_transcriber(settings: Settings) -> LocalTranscriber:
    return LocalTranscriber(settings)
