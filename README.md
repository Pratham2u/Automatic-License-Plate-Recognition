# ALPR dashboard

The dashboard displays the checked-in sample results immediately. Uploaded images
are sent to `server.py`, which calls the existing Plate Recognizer integration.

## Run recognition for uploads

From the repository root, install the Python dependencies used by the existing
recognizer, then start the backend with your API key:

```bash
export PLATE_RECOGNIZER_API_KEY="your-api-key"
python server.py
```

Leave this terminal running while using the dashboard. If the frontend says
that the recognition backend is not running, this command has not been started
or it exited with an error.

In a second terminal, start the frontend:

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173` and upload an image. The upload changes from
`Queued` to `Detected` (or `No plate`) when the backend response arrives.
