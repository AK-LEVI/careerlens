# CareerLens

CareerLens is a full-stack resume-to-career analysis app. The React frontend collects a resume and target role; the FastAPI backend analyzes the evidence, optionally adds OpenAI insights, and saves the result in SQLite so it can be revisited later.

## Run the app on Windows

Install Python and Node.js, then clone and open the project:

```powershell
git clone https://github.com/AK-LEVI/careerlens.git
cd careerlens
```

Open two terminals from the project root.

### Terminal 1 — backend

```powershell
cd .\backend
python -m pip install -r requirements.txt
```

To enable OpenAI insights, copy `backend/.env.example` to `backend/.env` and add your key as `OPENAI_API_KEY=...`. The key stays on the backend and `.env` files are ignored by Git. Without a key, the evidence matcher still works.

Then start the API:

```powershell
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Terminal 2 — frontend

```powershell
cd .\frontend
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. The API explorer is at <http://127.0.0.1:8000/docs>.

If this computer has Node but not npm on its PATH, install the Node.js LTS package from the official Node.js site, reopen VS Code, and run the frontend commands again.

## What it does

- Accepts PDF, DOCX, and TXT resumes up to 5 MB.
- Also accepts pasted resume text and includes a sample resume for a quick walkthrough.
- Compares resume evidence with 10 target roles and gives a score, strengths, skill gaps, and a roadmap.
- Searches and sorts saved analyses, loads older history pages, and exports reports as JSON or print-ready PDF.
- Checks public GitHub repositories when a profile link is supplied.
- Uses OpenAI's Responses API for tailored insights when `OPENAI_API_KEY` is configured. The key is only read by the backend. Resume text is sent to OpenAI only when this feature is enabled, and is never stored in SQLite.
- Stores analysis results and profile links in `backend/careerlens.db`; saved analyses are available in the website's history view.

See [backend/README.md](backend/README.md) for endpoint details and configuration. The app currently uses a shared, single-user SQLite history and has no sign-in. Keep a running instance local or behind authentication before letting other people submit resumes. Making this source repository public does not deploy or host the app.
