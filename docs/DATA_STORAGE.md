# Where Langogo keeps learner data

Render's free disk is erased on every restart, redeploy and sleep. So the live app keeps all learner data in
your Supabase **Postgres database** instead. On your own computer it still uses a file (`backend/data`).

## What is saved (per learner, after every change)
Progress, flowers, level, finished lessons, records, notes, settings, favourites, streak, the scored lines of
a lesson in progress, and (if they opted in) the research speech log.

## Set it up once (about 5 minutes)
1. Supabase dashboard > **Connect** (top bar) > **Session pooler** > copy the connection string.
2. Replace `[YOUR-PASSWORD]` with your database password (Project Settings > Database > Reset database
   password if you do not know it). Use letters and digits only, so nothing needs special encoding.
3. Render > service `langogo` > **Environment** > add `DATABASE_URL` = that string > Save (it redeploys).
4. Open `https://langogo.onrender.com/health`. You must see `"storage":"postgres","storage_ok":true`.
5. Optional: put the same line in `backend\.env` to use the live database from your computer, e.g. to run
   `python export_speech_data.py`.

Keep `DATABASE_URL` private. Never paste it into a chat or commit it. The tables are created automatically,
with row level security on, so the public Supabase key cannot read them.

## If the database is down
The app answers "Your data is temporarily unavailable" instead of showing an empty account, and a change that
could not be saved is kept in memory and saved on the next request (and when the server shuts down).

## Not covered
Raw voice takes (`backend/recordings`) are only used to score a line and are not shown in the app. They are
still erased when Render restarts. If you later need them for research, add Supabase Storage.
