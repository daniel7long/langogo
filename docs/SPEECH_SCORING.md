# Real speech scoring and speech-rate records

## 1. Turn on real scoring (Azure AI Speech, about 10 minutes)

1. In the Azure portal create a resource of type **Speech** (the free F0 tier is enough for testing).
2. Open it > **Keys and Endpoint**. Copy **KEY 1** and the **Location/Region** (for example `eastus`).
3. In `backend`, copy `env.example` to a new file named `.env` and fill in:
   ```
   AZURE_SPEECH_KEY=your-key
   AZURE_SPEECH_REGION=eastus
   ```
4. Install the audio reader once: `pip install -r requirements.txt` (it adds the `av` package; it carries its own
   ffmpeg, so nothing else is needed). If `pip install av` fails on your Python version, install ffmpeg instead
   (`winget install Gyan.FFmpeg`) and restart the terminal.
5. Restart uvicorn. Record a lesson: the result screen no longer shows the "Demo scores" notice.

Without a key the app still works but shows made-up numbers and a "Demo scores" banner on the result screen
(set `LANGOGO_SCORING=demo` to force that).

## 2. How the ratings are made

Each spoken line is sent to Azure **Pronunciation Assessment** together with the sentence you were supposed to say.
Azure answers with:

| Azure score | Meaning | Becomes |
|---|---|---|
| AccuracyScore | how close each sound and word was to a native speaker | **Pronunciation** |
| FluencyScore | smooth timing, few pauses and hesitations | **Fluency** |
| CompletenessScore | how many of the words you actually said | lowers both marks when words are skipped |

Pronunciation and Fluency are multiplied by Completeness / 100, so leaving words out cannot give a good grade.
The lesson result is the average of its lines; the grade is the average of the two marks:
A+ 90 and up, A 80, B+ 75, B 70, C 60, D below 60 (see `grade_for` in `store.py`).

The **words and phrases to practise** are the two lowest-scoring words and the lowest-scoring sentence of that
lesson, with a hint taken from the weakest sound of the word (`PHONEME_TIPS` in `scoring.py`). Retrying a word
scores the new take the same way. A lesson with great scores confetti-celebrates (A and A+).

## 3. Speech-rate records

Every scored line is logged (the time you spend recording is measured by the app and again by the server):

* in the saved state (`state["speech_log"]`, the latest 2000 lines), and
* appended to **`backend/data/speech_log.jsonl`**, one JSON object per line. Open it in Excel or pandas.

| Field | Meaning |
|---|---|
| `client_ms` | how long the record button was on (measured in the app) |
| `recorded_seconds` | length of the recording measured by the server |
| `speech_seconds` | first word to last word (Azure word timings) |
| `units`, `unit` | how many words (French, Spanish, German) or characters (Chinese, Japanese, Korean) were in the line |
| `rate_per_min` | units per minute **while speaking** (`units / speech_seconds * 60`) |
| `recorded_rate_per_min` | units per minute over the whole recording, pauses included |
| `fluency`, `pronunciation`, `completeness`, `engine` | the scores and which engine made them |

This is research data. It stays on the server: no endpoint returns it and the app never shows it.
To analyse it, run `python export_speech_data.py` in the backend folder. It writes `data/speech_export.csv`
and prints a per-language summary.
