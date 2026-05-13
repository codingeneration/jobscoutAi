# 🔍 Job Scout AI
### Automated job board scraper + AI scoring + daily email digest — built on Google Apps Script

> Stop spending hours on job boards. Job Scout AI wakes up every morning, scrapes 7 job sources, scores every listing against your profile using AI, and delivers a ranked report straight to your inbox.

---

## 📸 What You Get

Every morning you receive an email like this:

```
[Job Scout AI] 4 matches found — Wednesday, May 13

┌─────────────────────────────────────────────────┐
│  Senior Cloud Identity Engineer          9/10   │
│  Acme Corp · Remote · $150k–$180k               │
│  ✅ Strong Match — Deep IAM + SSO alignment     │
│  [View Job →]                                   │
├─────────────────────────────────────────────────┤
│  GWS Solutions Engineer                  8/10   │
│  ...                                            │
└─────────────────────────────────────────────────┘
```

Scored. Ranked. Linked. Ready to apply.

---

## ⚡ Quick Start

### 1 — Make a copy of the script
Click below to open your own private copy in Google Apps Script — no downloading, no uploading:

**👉 [Click here to copy the script](https://script.google.com/d/1Xxd60rkgXsUNLQgfE7wRyb4AxsAhRpa7MtHqbCMH_qZ46IkbU1b6lljR/copy)**

### 2 — Create a Google Sheet
- Go to [sheets.google.com](https://sheets.google.com) → New spreadsheet
- Name it anything (e.g. `Job Scout Tracker`)
- Copy the Sheet ID from the URL: `docs.google.com/spreadsheets/d/**THIS_PART**/edit`

### 3 — Get your free API keys

| Service | What it's for | Cost | Sign up |
|---|---|---|---|
| **Adzuna** | Primary job feed | Free | [developer.adzuna.com](https://developer.adzuna.com) |
| **Groq** | AI scoring engine | Free | [console.groq.com](https://console.groq.com) |
| **Jooble** *(optional)* | Additional job feed | Free | [jooble.org/api/about](https://jooble.org/api/about) |
| **Findwork** *(optional)* | Developer-friendly feed | Free | [findwork.dev](https://findwork.dev) |

> Adzuna and Groq are the only required ones. Jooble and Findwork are bonus sources — skip them if you want to keep setup simple.

### 4 — Fill in CONFIG

At the top of the script, update the `CONFIG` block with your values:

```javascript
var CONFIG = {
  ADZUNA_APP_ID:   'your_adzuna_app_id',
  ADZUNA_APP_KEY:  'your_adzuna_app_key',
  ADZUNA_QUERY:    'solutions engineer cloud identity',  // ← customize this
  ADZUNA_LOCATION: 'San Diego',                          // ← your city
  ADZUNA_DISTANCE: 50,                                   // miles radius

  GROQ_API_KEY:    'your_groq_api_key',
  GROQ_MODEL:      'llama-3.3-70b-versatile',

  SHEET_ID:        'your_google_sheet_id',
  SHEET_NAME:      'Jobs',

  EMAIL_TO:        'you@gmail.com',
  MIN_SCORE:       6,   // only email jobs scoring 6/10 or above
  TRIGGER_HOUR:    7    // 7 = 7:00 AM in your Google account timezone
};
```

### 5 — Run setup and test

In the Apps Script editor, run these functions in order:

| Function | What it does |
|---|---|
| `setup()` | Creates sheet headers + sets daily trigger. **Run once.** |
| `testSources()` | Checks all 7 job feeds are returning results |
| `testScoring()` | Fires 2 fake jobs through Groq to confirm scoring works |
| `testRun()` | Full end-to-end run — check your inbox after |

---

## 🎯 Customizing the Scoring Prompt

The AI scores each job against a candidate profile. **You need to update this to match your background.** Open the `buildScoringPrompt()` function and edit the profile section:

```javascript
'CANDIDATE PROFILE:\n' +
'- Target roles: GWS Solutions Engineer, Cloud Consultant, Identity/IAM Engineer\n' +
'- Core skills: Google Workspace Admin (7+ yrs), SAML/SSO, SCIM, IAM, Salesforce\n' +
'- Experience level: Senior\n' +
'- Location: San Diego, CA — prefers Remote or Hybrid\n' +
'- Target comp: $120k–$180k+\n' +
'- Ideal employers: tech companies, MSPs, Google partners\n' +
'- Not a fit: help desk, Tier 1 support, entry-level\n\n'
```

Change the roles, skills, location, salary range, and deal-breakers to match your situation. The better your profile description, the sharper the scores.

---

## 🗂️ How It Works

```
[Schedule Trigger — 7am daily]
        ↓
[Fetch from 7 job sources]
        ↓
[Deduplicate against Google Sheet tracker]
        ↓
[Batch score new listings via Groq / Llama 3.3]
        ↓
[Save all new jobs to Sheet]
        ↓
[Email ranked report — jobs above MIN_SCORE only]
```

Think of it like a personal recruiter that never sleeps, never gets tired, and has no financial incentive to send you bad leads.

---

## 📡 Job Sources

| Source | Type | Notes |
|---|---|---|
| Adzuna | General + location-based | Requires free API key |
| Remotive | Remote-only | No key needed |
| The Muse | Curated companies | No key needed |
| Jobicy | Remote tech-focused | No key needed |
| Arbeitnow | International + remote | No key needed |
| Jooble | Aggregator | Free key |
| Findwork | Developer roles | Free key |

---

## 🔑 Score Guide

| Score | Verdict | Meaning |
|---|---|---|
| 9–10 | 🟢 Perfect Match | Apply immediately |
| 7–8 | 🟢 Strong Match | High priority |
| 6 | 🟡 Decent Match | Worth a look |
| 4–5 | 🟠 Stretch | Skills gap exists |
| 1–3 | 🔴 Poor Match | Filtered out of email |

---

## 🛠️ Requirements

- A Google account (Gmail + Google Sheets + Apps Script — all free)
- Free Adzuna API key
- Free Groq API key
- ~10 minutes to set up

No servers. No hosting. No monthly fees. Runs entirely inside your Google account.

---

## 📋 Sheet Tracker

Every job found (regardless of score) gets logged to your Google Sheet:

`Job ID | Source | Date Found | Title | Company | Location | Salary | Score | Verdict | Reason | Apply? | URL`

This is your dedup layer — jobs already in the sheet are never re-scored or re-emailed.

---

## 🤝 Contributing

Pull requests welcome. Common improvements people might want to add:

- Additional job sources (LinkedIn, Greenhouse, Lever APIs)
- Slack or Discord notification option instead of / in addition to email
- Apply tracking column + follow-up reminders
- Resume keyword matching in the scoring prompt

---

## 📄 License

MIT — free to use, modify, and share. Attribution appreciated but not required.

---

## 👤 Author

Built by [Steve Moynihan](https://www.linkedin.com/in/stevenmoynihan/) — IT consultant and Google Workspace specialist.

Questions or feedback: open an issue or reach out on [LinkedIn](https://www.linkedin.com/in/stevenmoynihan/).
