import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Download,
  FileCheck2,
  FileSearch,
  FileText,
  Github,
  History,
  Layers3,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  Printer,
  Search,
  Sparkles,
  Target,
  Upload,
  X,
  Zap,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_RESUME_TEXT_CHARS = 120_000;
const HISTORY_PAGE_SIZE = 30;
const DEMO_RESUME = `Jordan Lee | Machine Learning Engineer

SUMMARY
Early-career machine learning engineer who builds practical data products from messy datasets. Comfortable taking a project from exploration through deployment and communicating the trade-offs.

EXPERIENCE
Junior Data Science Intern · Northstar Labs
- Built Python data pipelines and cleaned 80,000 customer records with Pandas.
- Used SQL joins and window functions to prepare analytics datasets.
- Trained and compared scikit-learn machine learning models; documented precision, recall, and model limitations.
- Prototyped a PyTorch deep learning classifier and tracked experiments with Git and GitHub.
- Deployed a FastAPI model service with Docker and added input validation.

PROJECTS
Customer Churn Predictor · Python, Pandas, SQL, scikit-learn, FastAPI, Docker
Created a reproducible notebook, evaluated a baseline, and shared results in a small dashboard with Matplotlib charts.

EDUCATION
BSc Computer Science · 2025`;

function errorMessage(payload, fallback) {
  const detail = payload?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg || "Invalid input").join(" · ");
  if (detail?.message) return detail.message;
  return fallback;
}

function scoreValue(score) {
  if (typeof score === "number") return score;
  return Number(score?.overall || 0);
}

function downloadReport(result) {
  const candidate = result?.candidate?.name || "candidate";
  const safeName = candidate.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "candidate";
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `careerlens-${safeName}-analysis.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ScoreDial({ score }) {
  return (
    <div className="score-dial" style={{ "--score": `${Math.max(0, Math.min(score, 100))}%` }}>
      <div className="score-dial__inner">
        <span className="score-dial__number">{score}</span>
        <span className="score-dial__label">out of 100</span>
      </div>
    </div>
  );
}

function App() {
  const [roles, setRoles] = useState([]);
  const [health, setHealth] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historySearch, setHistorySearch] = useState("");
  const [historySort, setHistorySort] = useState("newest");
  const [candidateName, setCandidateName] = useState("");
  const [targetRole, setTargetRole] = useState("ML Engineer");
  const [githubUrl, setGithubUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [resume, setResume] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [result, setResult] = useState(null);
  const [activeView, setActiveView] = useState("analyze");
  const [loading, setLoading] = useState(false);
  const [loadingHistoryId, setLoadingHistoryId] = useState(null);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const refreshHistory = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/analyses?limit=${HISTORY_PAGE_SIZE}`);
      if (!response.ok) return;
      const data = await response.json();
      setHistory(data);
      const total = response.headers.get("X-Total-Count");
      setHistoryTotal(total === null ? data.length : Number(total));
    } catch {
      // The API connection message is shown from the health request.
    }
  }, []);

  const loadMoreHistory = async () => {
    if (loadingMoreHistory || history.length >= historyTotal) return;
    setLoadingMoreHistory(true);
    try {
      const response = await fetch(`${API_BASE}/analyses?limit=${HISTORY_PAGE_SIZE}&offset=${history.length}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, "Could not load more saved analyses."));
      setHistory((current) => [...current, ...payload.filter((item) => !current.some((saved) => saved.id === item.id))]);
      const total = response.headers.get("X-Total-Count");
      if (total !== null) setHistoryTotal(Number(total));
    } catch (loadError) {
      setError(loadError.message || "Could not load more saved analyses.");
    } finally {
      setLoadingMoreHistory(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function loadAppData() {
      try {
        const [healthResponse, roleResponse] = await Promise.all([
          fetch(`${API_BASE}/health`),
          fetch(`${API_BASE}/roles`),
        ]);
        if (!healthResponse.ok || !roleResponse.ok) throw new Error("The CareerLens API did not respond.");
        const [healthData, roleData] = await Promise.all([healthResponse.json(), roleResponse.json()]);
        if (cancelled) return;
        setHealth(healthData);
        setRoles(roleData.roles || []);
        if (roleData.roles?.length) setTargetRole((current) => roleData.roles.some((item) => item.name === current) ? current : roleData.roles[0].name);
      } catch {
        if (!cancelled) setHealth({ status: "offline", database: "unknown", ai: { enabled: false } });
      }
    }
    loadAppData();
    refreshHistory();
    return () => { cancelled = true; };
  }, [refreshHistory]);

  const selectResume = (file) => {
    setError("");
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx", "txt"].includes(extension)) {
      setResume(null);
      setError("Choose a PDF, DOCX, or TXT resume.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setResume(null);
      setError("That file is over 5 MB. Choose a smaller resume.");
      return;
    }
    setResume(file);
    setResumeText("");
    setResult(null);
  };

  const analyzeResume = async (event) => {
    event.preventDefault();
    if (!resume && !resumeText.trim()) {
      setError("Upload a resume file or paste your resume text to start the analysis.");
      fileInputRef.current?.focus();
      return;
    }
    setLoading(true);
    setError("");
    setActiveView("analyze");
    setResult(null);
    const body = new FormData();
    body.append("name", candidateName.trim() || "Candidate");
    body.append("target_role", targetRole);
    if (resume) body.append("resume", resume);
    if (resumeText.trim()) body.append("resume_text", resumeText.trim());
    if (githubUrl.trim()) body.append("github_url", githubUrl.trim());
    if (linkedinUrl.trim()) body.append("linkedin_url", linkedinUrl.trim());
    if (portfolioUrl.trim()) body.append("portfolio_url", portfolioUrl.trim());

    try {
      const response = await fetch(`${API_BASE}/analyze`, { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, "Could not analyze this resume."));
      setResult(payload);
      await refreshHistory();
      window.setTimeout(() => document.getElementById("analysis-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (submissionError) {
      setError(submissionError.message || "Could not reach the backend. Start it on port 8000 and try again.");
    } finally {
      setLoading(false);
    }
  };

  const openSavedAnalysis = async (id) => {
    setLoadingHistoryId(id);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/analyses/${id}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, "Could not open this saved analysis."));
      setResult(payload);
      setActiveView("analyze");
      window.setTimeout(() => document.getElementById("analysis-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (loadError) {
      setError(loadError.message || "Could not load this saved analysis.");
    } finally {
      setLoadingHistoryId(null);
    }
  };

  const matchedCount = result?.skills?.filter((skill) => skill.status === "verified").length || 0;
  const score = scoreValue(result?.score);
  const currentRole = roles.find((role) => role.name === targetRole);
  const normalizedHistorySearch = historySearch.trim().toLowerCase();
  const filteredHistory = history
    .filter((item) => `${item.name || "Candidate"} ${item.target_role || ""} ${item.summary || ""}`.toLowerCase().includes(normalizedHistorySearch))
    .sort((left, right) => historySort === "score"
      ? scoreValue(right.score) - scoreValue(left.score)
      : new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  const backendOnline = health?.status === "ok";
  const aiEnabled = Boolean(health?.ai?.enabled);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="CareerLens home">
          <span className="brand-mark"><Target size={21} strokeWidth={2.25} /></span>
          <span className="brand-name">career<span>lens</span></span>
          <span className="brand-beta">BETA</span>
        </a>
        <nav className="topnav" aria-label="Main navigation">
          <button className={`topnav__item ${activeView === "analyze" ? "is-active" : ""}`} onClick={() => setActiveView("analyze")}>
            Workspace
          </button>
          <button className={`topnav__item ${activeView === "history" ? "is-active" : ""}`} onClick={() => setActiveView("history")}>
            My analyses <span className="nav-count">{history.length}</span>
          </button>
        </nav>
        <div className="topbar__right">
          <span className={`system-pill ${backendOnline ? "is-online" : health?.status === "offline" ? "is-offline" : ""}`}>
            <span className="system-pill__dot" />
            {backendOnline ? "System ready" : health?.status === "offline" ? "API offline" : "Connecting"}
          </span>
          <div className="avatar" title={candidateName || "Your workspace"}>{(candidateName.trim()[0] || "Y").toUpperCase()}</div>
        </div>
      </header>

      <main id="top" className="page-wrap">
        <section className="welcome-row">
          <div className="welcome-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> YOUR NEXT CHAPTER STARTS HERE</p>
            <h1>Make your next move<br /><span>with confidence.</span></h1>
            <p className="welcome-subtitle">See how your experience lines up with the role you want — and get a clear plan for what comes next.</p>
          </div>
          <div className="welcome-note">
            <div className="welcome-note__icon"><Sparkles size={18} /></div>
            <div><strong>A little clarity goes a long way.</strong><p>Start with your resume. We’ll take it from there.</p></div>
            <ArrowDownRight size={19} className="welcome-note__arrow" />
          </div>
        </section>

        <section className="metric-strip" aria-label="Workspace status">
          <div className="metric-item"><span className="metric-icon metric-icon--green"><BriefcaseBusiness size={17} /></span><div><strong>{roles.length || "—"}</strong><span>career paths</span></div></div>
          <div className="metric-divider" />
          <div className="metric-item"><span className="metric-icon metric-icon--lavender"><History size={17} /></span><div><strong>{history.length}</strong><span>saved analyses</span></div></div>
          <div className="metric-divider" />
          <div className="metric-item"><span className="metric-icon metric-icon--amber"><FileCheck2 size={17} /></span><div><strong>3 formats</strong><span>PDF · DOCX · TXT</span></div></div>
          <div className="metric-spacer" />
          <div className={`analysis-mode ${aiEnabled ? "analysis-mode--ai" : ""}`}>
            <span className="analysis-mode__icon"><Sparkles size={14} /></span>
            <span>{aiEnabled ? "AI insights enabled" : "Evidence based analysis"}</span>
            <CircleHelp size={14} className="muted-icon" title={aiEnabled ? "AI insights use the server configured OpenAI model." : "Set OPENAI_API_KEY in backend/.env to enable AI written insights."} />
          </div>
        </section>

        {activeView === "history" ? (
          <section className="history-page card-panel">
            <div className="section-heading">
              <div><p className="section-kicker">YOUR PROGRESS</p><h2>Saved analyses</h2><p className="section-description">Pick up where you left off and revisit your career plans.</p></div>
              <button className="button button--primary button--small" onClick={() => setActiveView("analyze")}><Sparkles size={16} /> New analysis</button>
            </div>
            {history.length === 0 ? (
              <div className="empty-state"><div className="empty-state__icon"><Layers3 size={25} /></div><h3>Your story starts with one upload</h3><p>Your completed analyses will be kept here so you can return to them anytime.</p><button className="button button--primary" onClick={() => setActiveView("analyze")}>Analyze a resume <ArrowRight size={16} /></button></div>
            ) : (
              <>
                <div className="history-tools">
                  <label className="history-search"><Search size={16} /><input type="search" value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Search by name, role, or summary" aria-label="Search saved analyses" /></label>
                  <label className="history-sort"><span>Sort by</span><select value={historySort} onChange={(event) => setHistorySort(event.target.value)} aria-label="Sort saved analyses"><option value="newest">Most recent</option><option value="score">Highest score</option></select><ChevronDown size={14} /></label>
                </div>
                <p className="history-count">Showing {filteredHistory.length} of {historyTotal} saved {historyTotal === 1 ? "analysis" : "analyses"}</p>
                {filteredHistory.length === 0 ? (
                  <div className="history-no-results"><h3>No matching analyses</h3><p>Try another name or role, or clear the search.</p><button type="button" className="text-button" onClick={() => setHistorySearch("")}>Clear search</button></div>
                ) : (
                  <div className="history-list">
                    {filteredHistory.map((item) => (
                  <button className="history-row" key={item.id} onClick={() => openSavedAnalysis(item.id)}>
                    <span className="history-row__icon"><FileText size={18} /></span>
                    <span className="history-row__main"><strong>{item.name || "Candidate"}</strong><span>{item.target_role} · {new Date(item.created_at).toLocaleDateString()}</span></span>
                    <span className="history-row__score">{scoreValue(item.score)}<small>/100</small></span>
                    {loadingHistoryId === item.id ? <LoaderCircle className="spin" size={17} /> : <ArrowUpRight size={17} className="history-row__arrow" />}
                  </button>
                ))}
                  </div>
                )}
                {history.length < historyTotal && <button type="button" className="button button--secondary history-load-more" onClick={loadMoreHistory} disabled={loadingMoreHistory}>{loadingMoreHistory ? <><LoaderCircle size={15} className="spin" /> Loading…</> : <>Load more analyses <ArrowDownRight size={15} /></>}</button>}
              </>
            )}
          </section>
        ) : (
          <>
            <div className="workspace-grid">
              <section className="form-card card-panel">
                <div className="section-heading section-heading--form">
                  <div><p className="section-kicker">STEP 01 <span>·</span> YOUR STARTING POINT</p><h2>Let’s get to know you</h2><p className="section-description">Share your resume and choose the role you have in mind.</p></div>
                  <div className="step-badge"><span>01</span> OF 01</div>
                </div>

                <form onSubmit={analyzeResume}>
                  <div className="field-grid">
                    <label className="field"><span>Your name <span className="optional-label">(optional)</span></span><input value={candidateName} onChange={(event) => setCandidateName(event.target.value)} placeholder="e.g. Jordan Lee" autoComplete="name" /></label>
                    <label className="field"><span>Role you’re aiming for</span><span className="select-wrap"><select value={targetRole} onChange={(event) => setTargetRole(event.target.value)} disabled={!roles.length}><option value="" disabled>Choose a career path</option>{roles.map((role) => <option key={role.name} value={role.name}>{role.name}</option>)}</select><ChevronDown size={16} /></span></label>
                  </div>

                  <div className="field upload-field">
                    <span className="field-label">Your resume <span className="required-dot">(required: upload or paste)</span></span>
                    <button type="button" className={`dropzone ${dragging ? "dropzone--active" : ""} ${resume ? "dropzone--file" : ""}`} onClick={() => fileInputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); selectResume(event.dataTransfer.files?.[0]); }} aria-describedby="upload-hint">
                      <input ref={fileInputRef} className="visually-hidden" type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => selectResume(event.target.files?.[0])} />
                      <span className={`dropzone__icon ${resume ? "dropzone__icon--ready" : ""}`}>{resume ? <CheckCircle2 size={23} /> : <Upload size={22} />}</span>
                      <span className="dropzone__copy">{resume ? <><strong>{resume.name}</strong><span>{(resume.size / 1024).toFixed(0)} KB · Ready to analyze</span></> : <><strong>Drop your resume here, or <u>browse files</u></strong><span>PDF, DOCX or TXT · up to 5 MB</span></>}</span>
                      {resume && <span className="dropzone__remove" onClick={(event) => { event.stopPropagation(); setResume(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} role="button" aria-label="Remove selected file"><X size={17} /></span>}
                    </button>
                    <div className="resume-text-entry">
                      <div className="resume-text-entry__heading"><span>Or paste resume text</span><button type="button" className="text-button" onClick={() => { setResume(null); if (fileInputRef.current) fileInputRef.current.value = ""; setCandidateName("Jordan Lee"); setResumeText(DEMO_RESUME); setResult(null); setError(""); }}>Try a sample</button></div>
                      <textarea value={resumeText} maxLength={MAX_RESUME_TEXT_CHARS} onChange={(event) => { const value = event.target.value; setResumeText(value); setError(""); setResult(null); if (value) { setResume(null); if (fileInputRef.current) fileInputRef.current.value = ""; } }} placeholder="Paste your experience, projects, education, and skills here…" aria-label="Paste resume text" />
                      <span className="resume-text-entry__count">{resumeText.length.toLocaleString()} / {MAX_RESUME_TEXT_CHARS.toLocaleString()} characters</span>
                    </div>
                    <span className="field-hint" id="upload-hint"><LockKeyhole size={12} /> Resume contents are used for this analysis and are not stored.</span>
                  </div>

                  <details className="optional-links">
                    <summary><span><Github size={16} /> Add profile links <span className="optional-label">(optional)</span></span><ChevronDown size={16} /></summary>
                    <div className="optional-links__fields">
                      <label className="field"><span>GitHub profile</span><input type="url" value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} placeholder="https://github.com/username" /></label>
                      <label className="field"><span>LinkedIn profile</span><input type="url" value={linkedinUrl} onChange={(event) => setLinkedinUrl(event.target.value)} placeholder="https://linkedin.com/in/you" /></label>
                      <label className="field"><span>Portfolio website</span><input type="url" value={portfolioUrl} onChange={(event) => setPortfolioUrl(event.target.value)} placeholder="https://your-portfolio.com" /></label>
                      <p className="optional-links__note">We check public GitHub projects. LinkedIn and portfolio links are saved with your analysis; their pages aren’t scraped.</p>
                    </div>
                  </details>

                  {error && <div className="error-banner" role="alert"><CircleHelp size={17} /><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={15} /></button></div>}
                  {!backendOnline && <div className="error-banner error-banner--soft" role="status"><CircleHelp size={17} /><span>Start the CareerLens backend at 127.0.0.1:8000, then refresh this page.</span></div>}

                  {aiEnabled && <p className="ai-privacy-note"><LockKeyhole size={13} /> AI is on: resume text is sent to OpenAI for insights. The API key stays on the server.</p>}
                  <button className="button button--primary analyze-button" type="submit" disabled={loading || !backendOnline || !roles.length}>
                    {loading ? <><LoaderCircle size={18} className="spin" /> Reading your experience…</> : <><Sparkles size={17} /> Reveal my career insights <ArrowRight size={17} /></>}
                  </button>
                  <p className="form-footnote">Your analysis will be saved to your CareerLens history.</p>
                </form>
              </section>

              <aside className="side-column">
                <section className="role-preview card-panel">
                  <div className="aside-heading"><span className="aside-heading__icon"><Target size={17} /></span><span>YOUR FOCUS</span><span className="live-dot" /></div>
                  <h3>{currentRole?.name || "Choose your role"}</h3>
                  <p className="role-preview__text">We’ll compare your experience with the skills commonly used in this path.</p>
                  <div className="skill-chip-list">{(currentRole?.skills || []).slice(0, 6).map((skill) => <span className="skill-chip" key={skill}>{skill}</span>)}</div>
                  <div className="role-preview__foot"><span><Layers3 size={14} /> {currentRole?.skills?.length || 0} focus skills</span><span>Role guide <ArrowUpRight size={13} /></span></div>
                </section>
                <section className="promise-card">
                  <div className="promise-card__spark"><Sparkles size={17} /></div>
                  <p className="promise-card__eyebrow">A CLEARER NEXT STEP</p>
                  <h3>Good careers are built one skill at a time.</h3>
                  <p>Get a focused roadmap shaped around the role you want, not a generic checklist.</p>
                  <div className="promise-card__foot"><span>Thoughtful guidance</span><span className="promise-card__dots"><i /><i /><i /></span></div>
                </section>
                <div className="privacy-card"><span className="privacy-card__icon"><LockKeyhole size={15} /></span><span><strong>Your upload isn’t stored</strong><small>We save the analysis, never the original file.</small></span></div>
              </aside>
            </div>

            {result && <section id="analysis-result" className="results-section">
              <div className="results-title-row"><div><p className="section-kicker">YOUR CAREER SNAPSHOT</p><h2>Here’s where you stand, {result.candidate?.name?.split(" ")[0] || "today"}.</h2></div><div className="result-title-actions"><span className={`result-engine ${result.ai?.enabled ? "result-engine--ai" : ""}`}><Sparkles size={14} />{result.ai?.enabled ? "AI insights" : "Evidence analysis"}</span><button type="button" className="report-action" onClick={() => window.print()}><Printer size={14} /> Save as PDF</button><button type="button" className="report-action" onClick={() => downloadReport(result)}><Download size={14} /> Download JSON</button></div></div>
              {result.warnings?.map((warning) => <div className="warning-banner" key={warning}><CircleHelp size={15} />{warning}</div>)}
              <div className="results-grid">
                <section className="score-card card-panel">
                  <div className="score-card__head"><span className="section-kicker">ROLE READINESS</span><span className="score-card__target"><Target size={14} /> {result.candidate?.target_role}</span></div>
                  <div className="score-card__body"><ScoreDial score={score} /><div className="score-copy"><span className="readiness-tag"><span />{result.score?.readiness || (score >= 80 ? "Strong match" : score >= 50 ? "Developing" : "Early stage")}</span><h3>{score >= 80 ? "A strong foundation." : score >= 50 ? "You’re building momentum." : "Every expert starts somewhere."}</h3><p>{result.summary}</p></div></div>
                  <div className="score-card__foot"><span><BadgeCheck size={15} /> {matchedCount} skills found</span><span><Target size={15} /> {result.skills?.length || 0} skills reviewed</span></div>
                </section>
                <section className="skills-card card-panel">
                  <div className="card-heading-row"><div><p className="section-kicker">THE SKILL MAP</p><h3>What we found</h3></div><span className="skill-count">{matchedCount}/{result.skills?.length || 0}</span></div>
                  <div className="skill-list">{result.skills?.map((skill) => <div className="skill-row" key={skill.name}><span className={`skill-status ${skill.status === "verified" ? "skill-status--found" : ""}`}>{skill.status === "verified" ? <Check size={12} /> : <span />}</span><span className="skill-row__name">{skill.name}</span><span className={`skill-row__label ${skill.status === "verified" ? "skill-row__label--found" : ""}`}>{skill.status === "verified" ? "Found" : "To build"}</span></div>)}</div>
                </section>
              </div>

              <div className="insight-grid">
                <section className="insight-card card-panel">
                  <div className="card-heading-row"><div><p className="section-kicker">YOUR STRENGTHS</p><h3>Build on what’s here</h3></div><span className="insight-icon insight-icon--green"><Zap size={17} /></span></div>
                  {result.role_fit && <p className="role-fit-copy">{result.role_fit}</p>}
                  {result.strengths?.length ? <div className="strength-list">{result.strengths.map((strength) => <span key={strength}><CheckCircle2 size={15} />{strength}</span>)}</div> : <p className="muted-copy">Add a little more role related experience to your resume and run the analysis again.</p>}
                </section>
                <section className="roadmap-card card-panel">
                  <div className="card-heading-row"><div><p className="section-kicker">YOUR NEXT STEPS</p><h3>A plan you can start</h3></div><span className="insight-icon insight-icon--amber"><Lightbulb size={17} /></span></div>
                  {result.roadmap?.length ? <div className="roadmap-list">{result.roadmap.map((step, index) => <article className="roadmap-step" key={`${step.skill}-${index}`}><span className="roadmap-step__number">{String(index + 1).padStart(2, "0")}</span><div className="roadmap-step__body"><div className="roadmap-step__top"><strong>{step.skill}</strong><span><Clock3 size={12} /> {step.estimated_time || "Start this week"}</span></div><p>{step.action}</p>{step.resource && <a href={step.resource} target="_blank" rel="noreferrer">Explore a learning resource <ArrowUpRight size={13} /></a>}</div></article>)}</div> : <div className="roadmap-complete"><span><CheckCircle2 size={20} /></span><div><strong>You’ve covered the focus skills.</strong><p>Keep sharpening them with a project that shows your work.</p></div></div>}
                </section>
              </div>
              {result.resume_quality && Object.keys(result.resume_quality).length > 0 && <section className="quality-card card-panel">
                <div className="card-heading-row"><div><p className="section-kicker">RESUME QUALITY</p><h3>Make the evidence easier to see</h3></div><span className="quality-score"><FileSearch size={15} /> {result.resume_quality.score || 0}/100</span></div>
                <p className="quality-intro">{result.resume_quality.label || "Resume review"} · This checks how clearly your resume shows work, not your ability or potential.</p>
                <div className="quality-signals">
                  <div><strong>{result.resume_quality.word_count || 0}</strong><span>words</span></div>
                  <div><strong>{result.resume_quality.sections?.length || 0}</strong><span>sections</span></div>
                  <div><strong>{result.resume_quality.action_verbs || 0}</strong><span>action verbs</span></div>
                  <div><strong>{result.resume_quality.impact_statements || 0}</strong><span>measurable results</span></div>
                </div>
                {result.resume_quality.suggestions?.length > 0 && <div className="quality-suggestions">{result.resume_quality.suggestions.map((suggestion) => <p key={suggestion}><CheckCircle2 size={14} />{suggestion}</p>)}</div>}
              </section>}
              {result.role_matches?.length > 0 && <section className="role-matches card-panel">
                <div className="card-heading-row"><div><p className="section-kicker">CAREER EXPLORER</p><h3>Other paths your experience can support</h3></div><span className="insight-icon insight-icon--green"><BarChart3 size={17} /></span></div>
                <p className="quality-intro">A quick comparison across CareerLens roles based on the same resume evidence.</p>
                <div className="role-match-list">{result.role_matches.map((match) => <div className="role-match" key={match.role}><div className="role-match__top"><strong>{match.role}</strong><span>{match.matched_skills}/{match.required_skills} skills · {match.score}%</span></div><div className="role-match__track"><i style={{ width: `${match.score}%` }} /></div>{match.role !== result.candidate?.target_role && <button type="button" onClick={() => { setTargetRole(match.role); setResult(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Explore this role <ArrowUpRight size={13} /></button>}</div>)}</div>
              </section>}
              {result.recommendations?.length > 0 && result.ai?.enabled && <section className="recommendation-bar"><span><Sparkles size={16} /> A personal note</span><p>{result.recommendations[0]}</p></section>}
              <div className="result-footer"><span><LockKeyhole size={13} /> Saved to your CareerLens history</span><button onClick={() => { setResult(null); setResume(null); setResumeText(""); setCandidateName(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}><ArrowLeft size={14} /> Start another analysis</button></div>
            </section>}

            {!result && <section className="how-section"><div><span className="how-section__number">01</span><span><strong>Share your resume</strong><small>We find the skills and experience you’ve already built.</small></span></div><ArrowRight size={17} /><div><span className="how-section__number">02</span><span><strong>Choose a direction</strong><small>Pick a role you’d like to grow into.</small></span></div><ArrowRight size={17} /><div><span className="how-section__number">03</span><span><strong>Get a clear plan</strong><small>See strengths, gaps and practical next steps.</small></span></div></section>}
          </>
        )}

        <footer className="page-footer"><a className="footer-brand" href="#top"><Target size={15} /> CareerLens</a><span>Small steps. Clear direction.</span><a href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer">API status <ArrowUpRight size={12} /></a></footer>
      </main>
    </div>
  );
}

export default App;
