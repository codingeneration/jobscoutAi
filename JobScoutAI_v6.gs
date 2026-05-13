// ================================================================
// 🔍 JOB SCOUT AI v6 — Google Apps Script
// ================================================================
// HOW TO USE:
//   1. Go to script.google.com → New Project → paste this file
//   2. Fill in your values in the CONFIG section below
//   3. Run setup() once — creates sheet headers + daily 7am trigger
//   4. Run testSources() to confirm jobs are coming in
//   5. Run testScoring() to confirm Groq scoring works
//   6. Run testRun() to fire the full workflow and check your inbox
// ================================================================

// ================================================================
// CONFIG — fill these in before running anything
// ================================================================

var CONFIG = {

  // Adzuna (free — sign up at developer.adzuna.com, takes 2 min)
  ADZUNA_APP_ID:   'YOUR_ADZUNA_APP_ID',
  ADZUNA_APP_KEY:  'YOUR_ADZUNA_APP_KEY',
  ADZUNA_QUERY:    'solutions engineer google workspace cloud identity',
  ADZUNA_LOCATION: 'San Diego',
  ADZUNA_DISTANCE: 50,
  ADZUNA_RESULTS:  50,

  // Groq — FREE, no credit card needed
  // Get your key at console.groq.com → API Keys → Create API Key
  GROQ_API_KEY: 'YOUR_GROQ_API_KEY',
  GROQ_MODEL:   'llama-3.3-70b-versatile',

  // Google Sheet — paste the ID from your sheet URL
  // URL: docs.google.com/spreadsheets/d/THIS_PART/edit
  SHEET_ID:   'YOUR_GOOGLE_SHEET_ID',
  SHEET_NAME: 'Jobs',

  // Your Gmail address
  EMAIL_TO: 'YOUR_EMAIL@gmail.com',

  // Only show jobs scoring this or higher in the email (1–10)
  MIN_SCORE: 6,

  // Hour to run daily (0–23, in your Google account timezone)
  TRIGGER_HOUR: 7

};


// ================================================================
// MAIN — runs every morning on schedule
// ================================================================

function runJobScout() {
  Logger.log('=== Job Scout AI v6 starting ===');

  var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName(CONFIG.SHEET_NAME);

  // 1. Fetch from all 7 sources
  var adzuna      = fetchAdzunaJobs();
  var remotive    = fetchRemotiveJobs();
  var muse        = fetchTheMuseJobs();
  var jobicy      = fetchJobicyJobs();
  var arbeit      = fetchArbeitnowJobs();
  var jooble      = fetchJoobleJobs();
  var findwork    = fetchFindworkJobs();

  var allJobs = adzuna.concat(remotive, muse, jobicy, arbeit, jooble, findwork);

  Logger.log('Total fetched: ' + allJobs.length +
    ' (Adzuna: ' + adzuna.length +
    ', Remotive: ' + remotive.length +
    ', Muse: ' + muse.length +
    ', Jobicy: ' + jobicy.length +
    ', Arbeitnow: ' + arbeit.length +
    ', Jooble: ' + jooble.length +
    ', Findwork: ' + findwork.length + ')');

  // 2. Dedup against tracker sheet
  var existingIds = getExistingIds(sheet);
  var newJobs     = deduplicateJobs(allJobs, existingIds);
  Logger.log(newJobs.length + ' new after dedup (existing tracked: ' + existingIds.size + ')');

  if (newJobs.length === 0) {
    GmailApp.sendEmail(CONFIG.EMAIL_TO,
      '[Job Scout AI] No New Listings Today',
      'No new job listings found. All recent posts are already tracked.');
    Logger.log('No new jobs — notification sent');
    return;
  }

  // 3. Score with Groq
  var scores     = scoreJobsWithAI(newJobs);
  var scoredJobs = mergeScores(newJobs, scores);

  // 4. Save all new jobs to sheet
  saveToSheet(sheet, scoredJobs);

  // 5. Filter and send email
  var topJobs = scoredJobs
    .filter(function(j) { return j.score >= CONFIG.MIN_SCORE; })
    .sort(function(a, b) { return b.score - a.score; });

  sendReport(topJobs, scoredJobs.length);
  Logger.log('=== Job Scout AI v6 complete ===');
}


// ================================================================
// JOB SOURCES
// ================================================================

function fetchAdzunaJobs() {
  try {
    var url = 'https://api.adzuna.com/v1/api/jobs/us/search/1' +
      '?app_id='    + CONFIG.ADZUNA_APP_ID +
      '&app_key='   + CONFIG.ADZUNA_APP_KEY +
      '&what='      + encodeURIComponent(CONFIG.ADZUNA_QUERY) +
      '&where='     + encodeURIComponent(CONFIG.ADZUNA_LOCATION) +
      '&distance='  + CONFIG.ADZUNA_DISTANCE +
      '&results_per_page=' + CONFIG.ADZUNA_RESULTS +
      '&content-type=application/json';
    var res  = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(res.getContentText());
    if (!data.results) return [];
    return data.results.map(function(j) {
      return {
        id:          'adzuna_' + j.id,
        title:       j.title       || 'Unknown Title',
        company:     j.company     ? j.company.display_name : 'Unknown',
        location:    j.location    ? j.location.display_name : 'Remote',
        salary:      j.salary_min  ? '$' + Math.round(j.salary_min/1000) + 'k–$' + Math.round(j.salary_max/1000) + 'k' : 'Not listed',
        description: (j.description || '').substring(0, 500),
        url:         j.redirect_url || '',
        source:      'Adzuna',
        date:        new Date().toLocaleDateString()
      };
    });
  } catch (e) {
    Logger.log('Adzuna error: ' + e.message);
    return [];
  }
}

function fetchRemotiveJobs() {
  try {
    var url = 'https://remotive.com/api/remote-jobs?category=software-dev&limit=50&search=google+workspace';
    var res  = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(res.getContentText());
    if (!data.jobs) return [];
    return data.jobs.map(function(j) {
      return {
        id:          'remotive_' + j.id,
        title:       j.title         || 'Unknown Title',
        company:     j.company_name  || 'Unknown',
        location:    j.candidate_required_location || 'Remote',
        salary:      j.salary        || 'Not listed',
        description: (j.description  || '').replace(/<[^>]+>/g, '').substring(0, 500),
        url:         j.url           || '',
        source:      'Remotive',
        date:        new Date().toLocaleDateString()
      };
    });
  } catch (e) {
    Logger.log('Remotive error: ' + e.message);
    return [];
  }
}

function fetchTheMuseJobs() {
  try {
    var url = 'https://www.themuse.com/api/public/jobs?category=IT&level=Senior+Level&page=0&descending=true';
    var res  = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(res.getContentText());
    if (!data.results) return [];
    return data.results.map(function(j) {
      var loc = j.locations && j.locations[0] ? j.locations[0].name : 'Remote';
      return {
        id:          'muse_' + j.id,
        title:       j.name          || 'Unknown Title',
        company:     j.company       ? j.company.name : 'Unknown',
        location:    loc,
        salary:      'Not listed',
        description: (j.contents    || '').replace(/<[^>]+>/g, '').substring(0, 500),
        url:         j.refs          ? j.refs.landing_page : '',
        source:      'The Muse',
        date:        new Date().toLocaleDateString()
      };
    });
  } catch (e) {
    Logger.log('The Muse error: ' + e.message);
    return [];
  }
}

function fetchJobicyJobs() {
  try {
    var url = 'https://jobicy.com/api/v2/remote-jobs?count=50&tag=cloud&industry=tech';
    var res  = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(res.getContentText());
    if (!data.jobs) return [];
    return data.jobs.map(function(j) {
      return {
        id:          'jobicy_' + j.id,
        title:       j.jobTitle      || 'Unknown Title',
        company:     j.companyName   || 'Unknown',
        location:    j.jobGeo        || 'Remote',
        salary:      j.annualSalaryMin ? '$' + j.annualSalaryMin + '–$' + j.annualSalaryMax : 'Not listed',
        description: (j.jobDescription || '').replace(/<[^>]+>/g, '').substring(0, 500),
        url:         j.url           || '',
        source:      'Jobicy',
        date:        new Date().toLocaleDateString()
      };
    });
  } catch (e) {
    Logger.log('Jobicy error: ' + e.message);
    return [];
  }
}

function fetchArbeitnowJobs() {
  try {
    var url = 'https://www.arbeitnow.com/api/job-board-api?tags[]=cloud&tags[]=identity';
    var res  = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(res.getContentText());
    if (!data.data) return [];
    return data.data.slice(0, 40).map(function(j) {
      return {
        id:          'arbeit_' + j.slug,
        title:       j.title         || 'Unknown Title',
        company:     j.company_name  || 'Unknown',
        location:    j.location      || 'Remote',
        salary:      'Not listed',
        description: (j.description  || '').replace(/<[^>]+>/g, '').substring(0, 500),
        url:         j.url           || '',
        source:      'Arbeitnow',
        date:        new Date().toLocaleDateString()
      };
    });
  } catch (e) {
    Logger.log('Arbeitnow error: ' + e.message);
    return [];
  }
}

function fetchJoobleJobs() {
  try {
    var payload = JSON.stringify({
      keywords: 'google workspace solutions engineer',
      location: 'San Diego, CA',
      radius:   '50'
    });
    var res = UrlFetchApp.fetch('https://jooble.org/api/YOUR_JOOBLE_KEY', {
      method:             'post',
      contentType:        'application/json',
      payload:            payload,
      muteHttpExceptions: true
    });
    var data = JSON.parse(res.getContentText());
    if (!data.jobs) return [];
    return data.jobs.slice(0, 30).map(function(j) {
      return {
        id:          'jooble_' + j.id,
        title:       j.title    || 'Unknown Title',
        company:     j.company  || 'Unknown',
        location:    j.location || 'Remote',
        salary:      j.salary   || 'Not listed',
        description: (j.snippet || '').substring(0, 500),
        url:         j.link     || '',
        source:      'Jooble',
        date:        new Date().toLocaleDateString()
      };
    });
  } catch (e) {
    Logger.log('Jooble error: ' + e.message);
    return [];
  }
}

function fetchFindworkJobs() {
  try {
    var url = 'https://findwork.dev/api/jobs/?search=google+workspace&sort_by=date';
    var res = UrlFetchApp.fetch(url, {
      headers:            { 'Authorization': 'Token YOUR_FINDWORK_KEY' },
      muteHttpExceptions: true
    });
    var data = JSON.parse(res.getContentText());
    if (!data.results) return [];
    return data.results.slice(0, 30).map(function(j) {
      return {
        id:          'findwork_' + j.id,
        title:       j.role         || 'Unknown Title',
        company:     j.company_name || 'Unknown',
        location:    j.remote       ? 'Remote' : (j.location || 'Unknown'),
        salary:      'Not listed',
        description: (j.text        || '').substring(0, 500),
        url:         j.url          || '',
        source:      'Findwork',
        date:        new Date().toLocaleDateString()
      };
    });
  } catch (e) {
    Logger.log('Findwork error: ' + e.message);
    return [];
  }
}


// ================================================================
// AI SCORING — Groq / llama-3.3-70b-versatile
// ================================================================

function scoreJobsWithAI(jobs) {
  var allScores = [];
  var batchSize = 10; // Groq handles 10 at a time cleanly

  for (var i = 0; i < jobs.length; i += batchSize) {
    var batch  = jobs.slice(i, i + batchSize);
    var scores = scoreWithGroq(batch);
    allScores  = allScores.concat(scores);
    if (i + batchSize < jobs.length) Utilities.sleep(1500); // rate limit buffer
  }
  return allScores;
}

function scoreWithGroq(jobs) {
  if (!CONFIG.GROQ_API_KEY || CONFIG.GROQ_API_KEY === 'YOUR_GROQ_API_KEY') {
    Logger.log('ERROR: Missing GROQ_API_KEY — get your free key at console.groq.com');
    return [];
  }

  var payload = {
    model:       CONFIG.GROQ_MODEL,
    max_tokens:  1000,
    temperature: 0.2,
    messages: [
      {
        role:    'system',
        content: 'You are a job match scorer. Return ONLY a valid JSON array. No markdown, no code blocks, no preamble. Raw JSON only.'
      },
      {
        role:    'user',
        content: buildScoringPrompt(jobs)
      }
    ]
  };

  try {
    var res = UrlFetchApp.fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:             'post',
      contentType:        'application/json',
      headers:            { 'Authorization': 'Bearer ' + CONFIG.GROQ_API_KEY },
      payload:            JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var data    = JSON.parse(res.getContentText());
    var rawText = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '[]';
    Logger.log('Groq response preview: ' + rawText.substring(0, 200));
    return parseScores(rawText);
  } catch (e) {
    Logger.log('Groq error: ' + e.message);
    return [];
  }
}

function buildScoringPrompt(jobs) {
  var jobList = jobs.map(function(j, idx) {
    return 'JOB ' + (idx + 1) + '\n' +
      'ID: '          + j.id          + '\n' +
      'Title: '       + j.title       + '\n' +
      'Company: '     + j.company     + '\n' +
      'Location: '    + j.location    + '\n' +
      'Salary: '      + j.salary      + '\n' +
      'Description: ' + j.description + '\n---';
  }).join('\n');

  return 'Score these jobs for a candidate:\n\n' +
    'CANDIDATE PROFILE:\n' +
    '- Target roles: GWS Solutions Engineer, Cloud Consultant, Identity/IAM Engineer, IT Consultant\n' +
    '- Core skills: Google Workspace Admin (7+ yrs), SAML/SSO, SCIM, IAM, Salesforce, FedRAMP, cloud migrations\n' +
    '- Experience level: Senior\n' +
    '- Location: San Diego, CA — prefers Remote or Hybrid (open to on-site locally)\n' +
    '- Target comp: $120k–$180k+\n' +
    '- Ideal employers: tech companies, MSPs, Google partners, VARs, enterprise SaaS\n' +
    '- Not a fit: help desk, Tier 1 support, break-fix IT, entry-level\n\n' +
    'SCORING SCALE:\n' +
    '10 = perfect match | 8–9 = strong | 6–7 = decent | 4–5 = stretch | 1–3 = poor\n\n' +
    'Return ONLY a raw JSON array, no other text:\n' +
    '[{"id":"job_id","score":8,"verdict":"Strong Match","reason":"one sentence why","apply":true}]\n\n' +
    'JOBS TO SCORE:\n' + jobList;
}

function parseScores(rawText) {
  try {
    var cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    var parsed  = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      Logger.log('Groq returned non-array — wrapping');
      return [];
    }
    return parsed;
  } catch (e) {
    Logger.log('Score parse error: ' + e.message + ' | Raw: ' + rawText.substring(0, 200));
    return [];
  }
}

function mergeScores(jobs, scores) {
  var scoreMap = {};
  scores.forEach(function(s) { if (s.id) scoreMap[s.id] = s; });
  return jobs.map(function(job) {
    var s = scoreMap[job.id] || { score: 0, verdict: 'Unscored', reason: 'Not evaluated', apply: false };
    return Object.assign({}, job, {
      score:   s.score   || 0,
      verdict: s.verdict || 'Unscored',
      reason:  s.reason  || '',
      apply:   s.apply   || false
    });
  });
}


// ================================================================
// SHEET MANAGEMENT
// ================================================================

function getExistingIds(sheet) {
  var ids = new Set();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) ids.add(data[i][0]);
  }
  return ids;
}

function deduplicateJobs(jobs, existingIds) {
  var seen = new Set();
  return jobs.filter(function(j) {
    if (existingIds.has(j.id) || seen.has(j.id)) return false;
    seen.add(j.id);
    return true;
  });
}

function saveToSheet(sheet, jobs) {
  if (jobs.length === 0) return;
  var rows = jobs.map(function(j) {
    return [j.id, j.source, j.date, j.title, j.company, j.location, j.salary, j.score, j.verdict, j.reason, j.apply ? 'Yes' : 'No', j.url];
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  Logger.log('Saved ' + jobs.length + ' jobs to sheet');
}


// ================================================================
// EMAIL REPORT
// ================================================================

function sendReport(topJobs, totalNew) {
  var date    = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  var subject = '[Job Scout AI] ' + topJobs.length + ' matches found — ' + date;

  var html = '<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">';
  html += '<h2 style="color:#1a73e8;">🔍 Job Scout AI — Daily Report</h2>';
  html += '<p style="color:#555;">' + date + ' &nbsp;|&nbsp; ' + totalNew + ' new listings scanned &nbsp;|&nbsp; ' + topJobs.length + ' above score threshold (' + CONFIG.MIN_SCORE + '/10)</p>';
  html += '<hr style="border:1px solid #eee;">';

  if (topJobs.length === 0) {
    html += '<p>No jobs scored ' + CONFIG.MIN_SCORE + ' or above today. Check back tomorrow.</p>';
  } else {
    topJobs.forEach(function(j) {
      var scoreColor = j.score >= 8 ? '#1e8e3e' : j.score >= 6 ? '#e37400' : '#c5221f';
      html += '<div style="margin:20px 0;padding:16px;border:1px solid #ddd;border-radius:6px;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';
      html += '<div>';
      html += '<h3 style="margin:0 0 4px;">' + j.title + '</h3>';
      html += '<p style="margin:0;color:#555;">' + j.company + ' &nbsp;·&nbsp; ' + j.location + '</p>';
      html += '<p style="margin:4px 0 0;color:#777;font-size:13px;">Salary: ' + j.salary + ' &nbsp;·&nbsp; Source: ' + j.source + '</p>';
      html += '</div>';
      html += '<div style="text-align:center;min-width:60px;">';
      html += '<span style="font-size:28px;font-weight:bold;color:' + scoreColor + ';">' + j.score + '</span>';
      html += '<div style="font-size:11px;color:' + scoreColor + ';">' + j.verdict + '</div>';
      html += '</div>';
      html += '</div>';
      html += '<p style="margin:10px 0 6px;font-size:14px;color:#333;"><em>' + j.reason + '</em></p>';
      html += '<a href="' + j.url + '" style="display:inline-block;padding:8px 16px;background:#1a73e8;color:#fff;text-decoration:none;border-radius:4px;font-size:14px;">View Job →</a>';
      html += '</div>';
    });
  }

  html += '<hr style="border:1px solid #eee;margin-top:30px;">';
  html += '<p style="color:#999;font-size:12px;">Job Scout AI v6 &nbsp;·&nbsp; Scores by Groq / Llama 3.3 &nbsp;·&nbsp; ' + totalNew + ' new listings tracked today</p>';
  html += '</div>';

  GmailApp.sendEmail(CONFIG.EMAIL_TO, subject, 'Your email client does not support HTML.', { htmlBody: html });
  Logger.log('Email sent: ' + subject);
}


// ================================================================
// SETUP & TEST FUNCTIONS
// ================================================================

// Run once to initialize the sheet + daily trigger
function setup() {
  // Create sheet headers
  var ss    = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);

  var headers = [['Job ID', 'Source', 'Date Found', 'Title', 'Company', 'Location', 'Salary', 'Score', 'Verdict', 'Reason', 'Apply?', 'URL']];
  sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
  sheet.getRange(1, 1, 1, headers[0].length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  Logger.log('Sheet initialized');

  // Delete old triggers, create new daily trigger
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('runJobScout')
    .timeBased()
    .everyDays(1)
    .atHour(CONFIG.TRIGGER_HOUR)
    .create();
  Logger.log('Daily trigger set for ' + CONFIG.TRIGGER_HOUR + ':00');
}

// Test all job sources — logs counts per source
function testSources() {
  Logger.log('Testing all 7 sources...');
  Logger.log('Adzuna:    ' + fetchAdzunaJobs().length);
  Logger.log('Remotive:  ' + fetchRemotiveJobs().length);
  Logger.log('The Muse:  ' + fetchTheMuseJobs().length);
  Logger.log('Jobicy:    ' + fetchJobicyJobs().length);
  Logger.log('Arbeitnow: ' + fetchArbeitnowJobs().length);
  Logger.log('Jooble:    ' + fetchJoobleJobs().length);
  Logger.log('Findwork:  ' + fetchFindworkJobs().length);
}

// Test Groq scoring with 2 fake jobs
function testScoring() {
  var fakeJobs = [
    {
      id: 'test_001', title: 'Senior GWS Solutions Engineer', company: 'Google',
      location: 'Remote', salary: '$160k', source: 'Test',
      description: 'Deep Google Workspace admin expertise required. SAML, SSO, SCIM, IAM, cloud migration experience needed. Work with enterprise SMB clients.'
    },
    {
      id: 'test_002', title: 'Help Desk Technician', company: 'Local IT Co',
      location: 'San Diego, CA', salary: '$45k', source: 'Test',
      description: 'Answer support tickets. Reset passwords. Install printers. Entry level IT support.'
    }
  ];
  var scores = scoreWithGroq(fakeJobs);
  Logger.log('Scoring results: ' + JSON.stringify(scores));
}

// Full dry run — fetches, scores, sends email
function testRun() {
  runJobScout();
}
