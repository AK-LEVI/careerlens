# CareerLens Backend

A FastAPI service for resume-based career readiness analysis. It extracts readable text from PDF, DOCX, or TXT resumes, matches evidence to a selected role, optionally checks public GitHub repositories, saves analysis results in SQLite, and returns a practical learning roadmap.

When `OPENAI_API_KEY` is configured, the backend also uses OpenAI's Responses API with a structured Pydantic response to produce a tailored summary, role fit, strengths, and recommendations. Without a key, the local evidence matcher provides the analysis and the site labels it accordingly.

## Run locally (Windows PowerShell)

```powershell
cd .\backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Open the API explorer at <http://127.0.0.1:8000/docs>. Health is at `/health` and supported roles are at `/roles`.

If the frontend runs on another local origin, set its exact URL before starting the server:

```powershell
$env:CAREERLENS_CORS_ORIGINS="http://localhost:3000,http://localhost:5173"
```

Set `CAREERLENS_DB_PATH` to move the SQLite database. By default, `careerlens.db` is created beside `main.py`.

To turn on AI, copy `.env.example` to `.env`, add your API key to `OPENAI_API_KEY`, and restart the backend. The frontend never receives this key. When AI is enabled, submitted resume text and public GitHub project signals are sent to OpenAI for analysis.

## Analyze a resume

JSON request:

```http
POST /analyze
Content-Type: application/json
```

```json
{
  "name": "Asha",
  "target_role": "Backend Developer",
  "resume_text": "Built Python REST APIs, PostgreSQL databases, and Docker deployments.",
  "github_url": "https://github.com/octocat",
  "linkedin_url": "https://www.linkedin.com/in/example",
  "portfolio_url": "https://example.com"
}
```

The same fields can be sent as `multipart/form-data` with a resume file in the `resume`, `resume_file`, or `resume_upload` field. Accepted file extensions are `.pdf`, `.docx`, and `.txt`; uploads are limited to 5 MB. Text can also be entered directly as `resume_text`. Resume contents are analyzed in memory and are not saved to the database.

GitHub profile and repository data is fetched from GitHub's public API. Its anonymous rate limit may be reached during development; for a higher quota, set `GITHUB_TOKEN` in the server environment or deployment secret store. Never put this token in frontend code or commit it to the repository. When GitHub is unavailable, analysis continues from the resume and returns a warning.

The analyzer matches skill names and known aliases in the resume and in public repository names, descriptions, languages, and topics. It does not scrape LinkedIn or portfolio pages. GitHub is optional; if GitHub is unavailable or rate-limited, the resume analysis still completes and a warning is returned. The numeric score is a transparent share of role skills with matching evidence, not an employment recommendation.

## API

- `GET /` — service metadata
- `GET /health` — service and SQLite health
- `GET /roles` — roles and their required skills
- `POST /analyze` — analyze JSON or multipart form data and save a result
- `GET /analyses?limit=20&offset=0` — paged history, returned as a JSON array; total row count is in `X-Total-Count`
- `GET /analyses/{id}` — read a saved analysis
- `GET /docs` — interactive API documentation

The existing `analyses` table is migrated additively, so saved analyses are preserved.

## Scope and deployment

This is a single-user hackathon backend with local SQLite and no login or user accounts. Keep it on localhost or behind an authenticated application gateway until account authentication and per-user data access are added. Skill matching is deterministic and explainable; it does not use an LLM, OCR for scanned resumes, or authenticated/closed profile data.
