from pathlib import Path

RECORDINGS_DIR = Path(__file__).parent / "recordings"  # your users' takes are saved here
STATIC_DIR = Path(__file__).parent / "static"  # files served at /static (share preview picture)
DATA_DIR = Path(__file__).parent / "data"  # the saved demo state (state.json)
