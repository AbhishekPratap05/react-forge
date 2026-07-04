import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper to parse arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    runNumber: process.env.GITHUB_RUN_NUMBER || 'local',
    commitSha: process.env.GITHUB_SHA || 'unknown',
    isLocal: false,
  };

  args.forEach((arg) => {
    if (arg.startsWith('--run-number=')) {
      params.runNumber = arg.split('=')[1];
    } else if (arg.startsWith('--commit-sha=')) {
      params.commitSha = arg.split('=')[1];
    } else if (arg === '--local') {
      params.isLocal = true;
      params.runNumber = 'local';
    }
  });

  return params;
}

async function main() {
  const params = parseArgs();
  const testResultsPath = path.join(rootDir, 'test-results.json');
  const reportsDir = path.join(rootDir, 'reports');

  await fs.ensureDir(reportsDir);

  if (!(await fs.pathExists(testResultsPath))) {
    console.error('Error: test-results.json not found! Run vitest with json reporter first.');
    process.exit(1);
  }

  const results = await fs.readJson(testResultsPath);
  const now = new Date();
  
  // 1. Gather stats
  const totalTests = results.numTotalTests || 0;
  const passedTests = results.numPassedTests || 0;
  const failedTests = results.numFailedTests || 0;
  const status = failedTests > 0 || totalTests === 0 ? 'failed' : 'passed';
  const duration = results.testResults ? results.testResults.reduce((acc, file) => {
    const fileDuration = (file.endTime && file.startTime) ? (file.endTime - file.startTime) : 0;
    return acc + fileDuration;
  }, 0) : 0;

  const timestamp = now.toISOString();
  const dateFormatted = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeFormatted = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const runName = params.runNumber === 'local' ? 'Local Run' : `Build #${params.runNumber}`;
  const reportFileName = `report-${params.runNumber}.html`;
  const reportFilePath = path.join(reportsDir, reportFileName);

  console.log(`Generating in-depth report: ${reportFileName}...`);

  // 2. Generate In-depth Report HTML
  const reportHtml = generateInDepthReportHtml(
    runName,
    params.commitSha,
    timestamp,
    dateFormatted,
    timeFormatted,
    status,
    passedTests,
    failedTests,
    totalTests,
    duration,
    results
  );
  await fs.writeFile(reportFilePath, reportHtml, 'utf8');

  // 3. Update History JSON
  const historyPath = path.join(reportsDir, 'history.json');
  let history = [];
  if (await fs.pathExists(historyPath)) {
    try {
      history = await fs.readJson(historyPath);
    } catch (e) {
      console.warn('Warning: Failed to parse history.json, resetting history.', e);
    }
  }

  // Upsert history entry
  const newEntry = {
    runNumber: params.runNumber,
    commitSha: params.commitSha,
    timestamp,
    date: dateFormatted,
    time: timeFormatted,
    status,
    passed: passedTests,
    failed: failedTests,
    total: totalTests,
    duration,
    reportFile: reportFileName,
  };

  const existingIdx = history.findIndex((entry) => entry.runNumber === params.runNumber);
  if (existingIdx >= 0) {
    history[existingIdx] = newEntry;
  } else {
    history.unshift(newEntry);
  }

  // Sort history: local runs first (optional, or just runNumber descending)
  // Let's sort by date/timestamp descending
  history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  await fs.writeJson(historyPath, history, { spaces: 2 });

  // 4. Generate Main Index HTML (Dashboard)
  console.log('Generating main history dashboard: index.html...');
  const indexHtml = generateDashboardHtml(history);
  await fs.writeFile(path.join(reportsDir, 'index.html'), indexHtml, 'utf8');

  console.log('Dashboard and reports generated successfully in "./reports" directory.');
}

// Generates the in-depth report for a single test run
function generateInDepthReportHtml(
  runName,
  commitSha,
  timestamp,
  date,
  time,
  status,
  passed,
  failed,
  total,
  duration,
  results
) {
  const statusColor = status === 'passed' ? 'var(--color-pass)' : 'var(--color-fail)';
  const statusGlow = status === 'passed' ? 'var(--color-pass-glow)' : 'var(--color-fail-glow)';
  const statusText = status.toUpperCase();

  // Parse test files into details
  const suiteCards = results.testResults ? results.testResults.map((file, fileIdx) => {
    const fileBasename = path.basename(file.name);
    const fileStatus = file.status === 'passed' ? 'passed' : 'failed';
    const assertions = file.assertionResults || [];
    const filePassed = assertions.filter(r => r.status === 'passed').length;
    const fileTotal = assertions.length;
    const fileFailed = fileTotal - filePassed;
    const fileStatusColor = fileStatus === 'passed' ? 'var(--color-pass)' : 'var(--color-fail)';
    const fileIcon = fileStatus === 'passed' ? 'check-circle' : 'x-circle';

    let testRows = '';
    if (assertions.length > 0) {
      testRows = assertions.map((test, testIdx) => {
        const testPassed = test.status === 'passed';
        const rowStatusColor = testPassed ? 'var(--color-pass)' : 'var(--color-fail)';
        const rowIcon = testPassed ? 'check' : 'x';
        const durationFormatted = `${test.duration || 0}ms`;

        let errorBlock = '';
        if (!testPassed && test.failureMessages && test.failureMessages.length > 0) {
          // Clean ANSI colors from failure messages
          const cleanMsg = test.failureMessages.join('\n').replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
          errorBlock = `
            <div class="error-details">
              <pre><code>${escapeHtml(cleanMsg)}</code></pre>
            </div>
          `;
        }

        return `
          <div class="test-row ${test.status}">
            <div class="test-row-header" onclick="toggleError(${fileIdx}, ${testIdx})">
              <div class="test-title">
                <i data-lucide="${rowIcon}" style="color: ${rowStatusColor}"></i>
                <span>${escapeHtml(test.fullName)}</span>
              </div>
              <div class="test-meta">
                <span class="test-duration">${durationFormatted}</span>
                ${!testPassed ? `<i data-lucide="chevron-down" class="chevron-icon"></i>` : ''}
              </div>
            </div>
            ${errorBlock}
          </div>
        `;
      }).join('');
    } else if (file.message) {
      // Compilation / syntax error in the suite itself
      const cleanMsg = file.message.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
      testRows = `
        <div class="error-details" style="display: block; border-top: none;">
          <p style="color: var(--color-fail); font-weight: 600; margin-bottom: 0.5rem; font-size: 0.95rem;">Suite compilation / loading failed:</p>
          <pre><code>${escapeHtml(cleanMsg)}</code></pre>
        </div>
      `;
    } else {
      testRows = `
        <div class="error-details" style="display: block; border-top: none; color: var(--text-secondary);">
          No tests run in this suite.
        </div>
      `;
    }

    return `
      <div class="suite-card ${fileStatus}">
        <div class="suite-card-header" onclick="toggleSuite(${fileIdx})">
          <div class="suite-info">
            <i data-lucide="${fileIcon}" style="color: ${fileStatusColor}"></i>
            <h3>${escapeHtml(fileBasename)}</h3>
          </div>
          <div class="suite-stats">
            <span class="badge ${fileStatus}">${filePassed}/${fileTotal} Passed</span>
            <i data-lucide="chevron-down" class="suite-chevron"></i>
          </div>
        </div>
        <div class="suite-body" id="suite-body-${fileIdx}">
          ${testRows}
        </div>
      </div>
    `;
  }).join('') : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>React Forge CLI - Test Run Details</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    :root {
      --bg-dark: #0b0f19;
      --bg-card: rgba(17, 24, 39, 0.75);
      --border-card: rgba(255, 255, 255, 0.08);
      --text-primary: #f3f4f6;
      --text-secondary: #9ca3af;
      --color-pass: #10b981;
      --color-pass-glow: rgba(16, 185, 129, 0.12);
      --color-fail: #f43f5e;
      --color-fail-glow: rgba(244, 63, 94, 0.12);
      --color-accent: #6366f1;
      --color-accent-glow: rgba(99, 102, 241, 0.2);
      --font-family: 'Outfit', sans-serif;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-dark);
      background-image: 
        radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.08) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(244, 63, 94, 0.05) 0px, transparent 50%);
      color: var(--text-primary);
      font-family: var(--font-family);
      min-height: 100vh;
      padding: 2rem 1rem;
      line-height: 1.5;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      animation: fadeIn 0.4s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--border-card);
      padding-bottom: 1.5rem;
    }

    .back-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.95rem;
      transition: all 0.2s ease;
      background: rgba(255, 255, 255, 0.03);
      padding: 0.5rem 1rem;
      border-radius: 8px;
      border: 1px solid var(--border-card);
    }

    .back-btn:hover {
      color: var(--text-primary);
      background: rgba(255, 255, 255, 0.07);
      border-color: rgba(255, 255, 255, 0.2);
      transform: translateX(-2px);
    }

    .build-title {
      font-size: 1.8rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 0.8rem;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.75rem;
      font-size: 0.8rem;
      font-weight: 700;
      border-radius: 9999px;
      letter-spacing: 0.05em;
    }

    .status-badge.passed {
      background: var(--color-pass-glow);
      color: var(--color-pass);
      border: 1px solid rgba(16, 185, 129, 0.3);
      box-shadow: 0 0 12px rgba(16, 185, 129, 0.1);
    }

    .status-badge.failed {
      background: var(--color-fail-glow);
      color: var(--color-fail);
      border: 1px solid rgba(244, 63, 94, 0.3);
      box-shadow: 0 0 12px rgba(244, 63, 94, 0.1);
    }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2.5rem;
    }

    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    }

    .stat-card .label {
      color: var(--text-secondary);
      font-size: 0.85rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }

    .stat-card .value {
      font-size: 1.6rem;
      font-weight: 700;
      display: flex;
      align-items: baseline;
      gap: 0.3rem;
    }

    .stat-card .sub-value {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    /* Filtering */
    .filter-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .section-title {
      font-size: 1.2rem;
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    .filter-buttons {
      display: flex;
      gap: 0.5rem;
      background: rgba(255, 255, 255, 0.03);
      padding: 0.25rem;
      border-radius: 8px;
      border: 1px solid var(--border-card);
    }

    .filter-btn {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      padding: 0.4rem 0.8rem;
      font-size: 0.85rem;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      font-family: var(--font-family);
      transition: all 0.2s ease;
    }

    .filter-btn.active {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-primary);
    }

    .filter-btn:hover:not(.active) {
      color: var(--text-primary);
    }

    /* Suite Card */
    .suite-card {
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 12px;
      margin-bottom: 1.25rem;
      overflow: hidden;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      transition: border-color 0.2s ease;
    }

    .suite-card.failed {
      border-left: 4px solid var(--color-fail);
    }

    .suite-card.passed {
      border-left: 4px solid var(--color-pass);
    }

    .suite-card-header {
      padding: 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      user-select: none;
      transition: background 0.2s ease;
    }

    .suite-card-header:hover {
      background: rgba(255, 255, 255, 0.02);
    }

    .suite-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .suite-info h3 {
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .suite-stats {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .badge {
      display: inline-flex;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.15rem 0.5rem;
      border-radius: 6px;
    }

    .badge.passed {
      background: rgba(16, 185, 129, 0.1);
      color: var(--color-pass);
      border: 1px solid rgba(16, 185, 129, 0.2);
    }

    .badge.failed {
      background: rgba(244, 63, 94, 0.1);
      color: var(--color-fail);
      border: 1px solid rgba(244, 63, 94, 0.2);
    }

    .suite-chevron, .chevron-icon {
      transition: transform 0.2s ease;
      color: var(--text-secondary);
      width: 18px;
      height: 18px;
    }

    .suite-card.collapsed .suite-chevron {
      transform: rotate(-90deg);
    }

    .suite-body {
      border-top: 1px solid var(--border-card);
      background: rgba(0, 0, 0, 0.12);
      transition: max-height 0.3s ease-out;
      overflow: hidden;
    }

    .suite-card.collapsed .suite-body {
      display: none;
    }

    /* Test Row */
    .test-row {
      border-bottom: 1px solid var(--border-card);
    }

    .test-row:last-child {
      border-bottom: none;
    }

    .test-row-header {
      padding: 1rem 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      transition: background 0.2s ease;
    }

    .test-row-header:hover {
      background: rgba(255, 255, 255, 0.01);
    }

    .test-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.95rem;
      font-weight: 400;
    }

    .test-title i {
      width: 16px;
      height: 16px;
    }

    .test-meta {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .test-duration {
      font-size: 0.85rem;
      color: var(--text-secondary);
      font-family: monospace;
    }

    .test-row.failed .test-row-header .test-title span {
      color: #ffe4e6;
    }

    .test-row.collapsed .chevron-icon {
      transform: rotate(-90deg);
    }

    /* Error details */
    .error-details {
      background: rgba(244, 63, 94, 0.04);
      border-top: 1px solid rgba(244, 63, 94, 0.1);
      border-bottom: 1px solid rgba(244, 63, 94, 0.1);
      padding: 1.25rem;
      overflow-x: auto;
    }

    .error-details pre {
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.85rem;
      color: #fda4af;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .test-row.collapsed .error-details {
      display: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <a href="index.html" class="back-btn">
          <i data-lucide="arrow-left"></i>
          Back to Dashboard
        </a>
      </div>
      <div class="build-title">
        <span>${escapeHtml(runName)}</span>
        <span class="status-badge ${status}">${statusText}</span>
      </div>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <span class="label">Status</span>
        <span class="value" style="color: ${statusColor}; text-shadow: 0 0 10px ${statusGlow}">
          ${statusText}
        </span>
      </div>
      <div class="stat-card">
        <span class="label">Test Results</span>
        <span class="value">
          ${passed}/${total}
          <span class="sub-value">passed</span>
        </span>
      </div>
      <div class="stat-card">
        <span class="label">Duration</span>
        <span class="value">
          ${(duration / 1000).toFixed(2)}s
        </span>
      </div>
      <div class="stat-card">
        <span class="label">Commit</span>
        <span class="value" style="font-size: 1.1rem; font-family: monospace; word-break: break-all; margin-top: auto; margin-bottom: auto;">
          ${commitSha.substring(0, 7)}
        </span>
      </div>
    </div>

    <div class="filter-bar">
      <h2 class="section-title">Test Suites</h2>
      <div class="filter-buttons">
        <button class="filter-btn active" onclick="setFilter('all')">All</button>
        <button class="filter-btn" onclick="setFilter('failed')">Failed</button>
        <button class="filter-btn" onclick="setFilter('passed')">Passed</button>
      </div>
    </div>

    <div class="suites-list">
      ${suiteCards}
    </div>
  </div>

  <script>
    lucide.createIcons();

    function toggleSuite(id) {
      const card = document.querySelectorAll('.suite-card')[id];
      card.classList.toggle('collapsed');
      const body = document.getElementById('suite-body-' + id);
      if (card.classList.contains('collapsed')) {
        body.style.display = 'none';
      } else {
        body.style.display = 'block';
      }
    }

    function toggleError(fileIdx, testIdx) {
      // Find within the specific suite body
      const suiteBody = document.getElementById('suite-body-' + fileIdx);
      const rows = suiteBody.querySelectorAll('.test-row');
      const row = rows[testIdx];
      row.classList.toggle('collapsed');
    }

    function setFilter(type) {
      // Update buttons
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText.toLowerCase() === type) {
          btn.classList.add('active');
        }
      });

      // Filter suites and rows
      const suiteCards = document.querySelectorAll('.suite-card');
      suiteCards.forEach((card, fileIdx) => {
        const rows = card.querySelectorAll('.test-row');
        let visibleRowsInSuite = 0;

        rows.forEach(row => {
          const isPassed = row.classList.contains('passed');
          const isFailed = row.classList.contains('failed');

          if (type === 'all' || (type === 'passed' && isPassed) || (type === 'failed' && isFailed)) {
            row.style.display = 'block';
            visibleRowsInSuite++;
          } else {
            row.style.display = 'none';
          }
        });

        if (type === 'all') {
          card.style.display = 'block';
        } else if (type === 'passed' && card.classList.contains('passed')) {
          card.style.display = 'block';
        } else if (type === 'failed' && card.classList.contains('failed')) {
          card.style.display = 'block';
        } else if (visibleRowsInSuite > 0) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    }
  </script>
</body>
</html>
  `;
}

// Generates the main dashboard html file listing all historical runs
function generateDashboardHtml(history) {
  const totalRuns = history.length;
  const passedRuns = history.filter((r) => r.status === 'passed').length;
  const successRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 100;
  
  const latestRun = history[0];
  const latestStatusText = latestRun ? latestRun.status.toUpperCase() : 'NO RUNS';
  const latestStatusColor = latestRun 
    ? (latestRun.status === 'passed' ? 'var(--color-pass)' : 'var(--color-fail)') 
    : 'var(--text-secondary)';
  const latestStatusGlow = latestRun
    ? (latestRun.status === 'passed' ? 'var(--color-pass-glow)' : 'var(--color-fail-glow)')
    : 'transparent';

  const rows = history.map((run) => {
    const statusText = run.status.toUpperCase();
    const statusClass = run.status;
    const badgeColor = run.status === 'passed' ? 'var(--color-pass)' : 'var(--color-fail)';
    const runName = run.runNumber === 'local' ? 'Local Run' : `Build #${run.runNumber}`;
    
    return `
      <tr class="clickable-row" onclick="window.location.href='${run.reportFile}'" data-status="${run.status}" data-build="${run.runNumber}" data-commit="${run.commitSha}">
        <td>
          <div class="build-name-cell">
            <i data-lucide="${run.status === 'passed' ? 'check-circle-2' : 'alert-circle'}" style="color: ${badgeColor}"></i>
            <span>${escapeHtml(runName)}</span>
          </div>
        </td>
        <td>
          <span class="status-badge-inline ${statusClass}">${statusText}</span>
        </td>
        <td>
          <div class="timestamp-cell">
            <span class="date">${escapeHtml(run.date)}</span>
            <span class="time">${escapeHtml(run.time)}</span>
          </div>
        </td>
        <td class="results-cell">
          <span class="passed-count">${run.passed}</span> / <span class="total-count">${run.total}</span>
        </td>
        <td>
          <span class="duration">${(run.duration / 1000).toFixed(2)}s</span>
        </td>
        <td>
          <span class="commit-hash">${escapeHtml(run.commitSha.substring(0, 7))}</span>
        </td>
        <td style="text-align: right;">
          <a href="${run.reportFile}" class="view-btn">
            View Details
            <i data-lucide="chevron-right"></i>
          </a>
        </td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>React Forge CLI - Test History Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    :root {
      --bg-dark: #0b0f19;
      --bg-card: rgba(17, 24, 39, 0.75);
      --border-card: rgba(255, 255, 255, 0.08);
      --text-primary: #f3f4f6;
      --text-secondary: #9ca3af;
      --color-pass: #10b981;
      --color-pass-glow: rgba(16, 185, 129, 0.12);
      --color-fail: #f43f5e;
      --color-fail-glow: rgba(244, 63, 94, 0.12);
      --color-accent: #6366f1;
      --color-accent-glow: rgba(99, 102, 241, 0.2);
      --font-family: 'Outfit', sans-serif;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-dark);
      background-image: 
        radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.08) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(244, 63, 94, 0.05) 0px, transparent 50%);
      color: var(--text-primary);
      font-family: var(--font-family);
      min-height: 100vh;
      padding: 3rem 1.5rem;
      line-height: 1.5;
    }

    .container {
      max-width: 1000px;
      margin: 0 auto;
      animation: fadeIn 0.4s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    header {
      margin-bottom: 2.5rem;
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .brand-title {
      font-size: 2.2rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      background: linear-gradient(135deg, #fff 30%, #a5b4fc 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .brand-subtitle {
      color: var(--text-secondary);
      font-size: 0.95rem;
      margin-top: 0.25rem;
    }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.5rem;
      margin-bottom: 3rem;
    }

    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 16px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }

    .stat-card:hover {
      transform: translateY(-4px);
      border-color: rgba(255, 255, 255, 0.15);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
    }

    .stat-card::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 4px;
      background: transparent;
    }

    .stat-card.accent::after {
      background: var(--color-accent);
    }

    .stat-card.pass::after {
      background: var(--color-pass);
    }

    .stat-card.fail::after {
      background: var(--color-fail);
    }

    .stat-card .label {
      color: var(--text-secondary);
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }

    .stat-card .value {
      font-size: 2.2rem;
      font-weight: 800;
      letter-spacing: -0.01em;
      display: flex;
      align-items: baseline;
      gap: 0.3rem;
      margin-top: auto;
    }

    /* Filters and Controls */
    .controls-panel {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .search-container {
      position: relative;
      flex: 1;
      max-width: 350px;
      min-width: 250px;
    }

    .search-container i {
      position: absolute;
      left: 1rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-secondary);
      pointer-events: none;
      width: 18px;
      height: 18px;
    }

    .search-input {
      width: 100%;
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 10px;
      padding: 0.75rem 1rem 0.75rem 2.75rem;
      color: var(--text-primary);
      font-family: var(--font-family);
      font-size: 0.9rem;
      outline: none;
      transition: all 0.2s ease;
      backdrop-filter: blur(10px);
    }

    .search-input:focus {
      border-color: var(--color-accent);
      box-shadow: 0 0 0 3px var(--color-accent-glow);
    }

    .filter-buttons {
      display: flex;
      gap: 0.5rem;
      background: rgba(255, 255, 255, 0.03);
      padding: 0.25rem;
      border-radius: 10px;
      border: 1px solid var(--border-card);
    }

    .filter-btn {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      padding: 0.5rem 1.25rem;
      font-size: 0.85rem;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      font-family: var(--font-family);
      transition: all 0.2s ease;
    }

    .filter-btn.active {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-primary);
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }

    .filter-btn:hover:not(.active) {
      color: var(--text-primary);
    }

    /* History Table */
    .table-container {
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 16px;
      overflow: hidden;
      backdrop-filter: blur(10px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    th {
      padding: 1.25rem 1.5rem;
      color: var(--text-secondary);
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--border-card);
    }

    td {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border-card);
      font-size: 0.95rem;
      color: var(--text-primary);
      vertical-align: middle;
    }

    tr:last-child td {
      border-bottom: none;
    }

    .clickable-row {
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .clickable-row:hover {
      background: rgba(255, 255, 255, 0.02);
    }

    .build-name-cell {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 600;
    }

    .build-name-cell i {
      width: 20px;
      height: 20px;
    }

    .status-badge-inline {
      display: inline-flex;
      align-items: center;
      padding: 0.2rem 0.6rem;
      font-size: 0.75rem;
      font-weight: 700;
      border-radius: 6px;
      letter-spacing: 0.05em;
    }

    .status-badge-inline.passed {
      background: rgba(16, 185, 129, 0.1);
      color: var(--color-pass);
      border: 1px solid rgba(16, 185, 129, 0.2);
    }

    .status-badge-inline.failed {
      background: rgba(244, 63, 94, 0.1);
      color: var(--color-fail);
      border: 1px solid rgba(244, 63, 94, 0.2);
    }

    .timestamp-cell {
      display: flex;
      flex-direction: column;
    }

    .timestamp-cell .date {
      color: var(--text-primary);
      font-weight: 500;
    }

    .timestamp-cell .time {
      color: var(--text-secondary);
      font-size: 0.8rem;
    }

    .results-cell {
      font-family: monospace;
      font-size: 0.95rem;
    }

    .results-cell .passed-count {
      color: var(--color-pass);
      font-weight: 600;
    }

    .results-cell .total-count {
      color: var(--text-secondary);
    }

    .duration {
      color: var(--text-secondary);
      font-family: monospace;
    }

    .commit-hash {
      font-family: monospace;
      color: var(--text-secondary);
      background: rgba(255, 255, 255, 0.04);
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.04);
    }

    .view-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--color-accent);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .clickable-row:hover .view-btn {
      color: #818cf8;
      transform: translateX(2px);
    }

    .view-btn i {
      width: 16px;
      height: 16px;
    }

    .empty-state {
      padding: 4rem 2rem;
      text-align: center;
      color: var(--text-secondary);
    }

    .empty-state i {
      width: 48px;
      height: 48px;
      margin-bottom: 1rem;
      stroke-width: 1.5;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-content">
        <div>
          <h1 class="brand-title">
            <i data-lucide="shield-check" style="color: var(--color-accent); width: 32px; height: 32px;"></i>
            React Forge CLI
          </h1>
          <p class="brand-subtitle">Historical test reports & build stability logs</p>
        </div>
      </div>
    </header>

    <div class="stats-grid">
      <div class="stat-card accent">
        <span class="label">Total Runs</span>
        <span class="value">${totalRuns}</span>
      </div>
      <div class="stat-card pass">
        <span class="label">Success Rate</span>
        <span class="value">${successRate}%</span>
      </div>
      <div class="stat-card fail">
        <span class="label">Latest Status</span>
        <span class="value" style="color: ${latestStatusColor}; text-shadow: 0 0 10px ${latestStatusGlow}">
          ${latestStatusText}
        </span>
      </div>
    </div>

    <div class="controls-panel">
      <div class="search-container">
        <i data-lucide="search"></i>
        <input type="text" id="search" class="search-input" placeholder="Search by build number or commit..." oninput="filterRows()">
      </div>
      <div class="filter-buttons">
        <button class="filter-btn active" onclick="setFilter('all')">All Runs</button>
        <button class="filter-btn" onclick="setFilter('passed')">Passed</button>
        <button class="filter-btn" onclick="setFilter('failed')">Failed</button>
      </div>
    </div>

    <div class="table-container">
      ${
        totalRuns === 0
          ? `
            <div class="empty-state">
              <i data-lucide="clipboard-x"></i>
              <h3>No builds logged yet</h3>
              <p style="font-size: 0.9rem; margin-top: 0.5rem;">Run the test suite in CI or locally to generate reports.</p>
            </div>
            `
          : `
            <table>
              <thead>
                <tr>
                  <th>Build Name</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                  <th>Tests Passed</th>
                  <th>Duration</th>
                  <th>Commit</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="runs-tbody">
                ${rows}
              </tbody>
            </table>
            `
      }
    </div>
  </div>

  <script>
    lucide.createIcons();

    let currentFilter = 'all';

    function setFilter(filter) {
      currentFilter = filter;
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText.toLowerCase().includes(filter)) {
          btn.classList.add('active');
        }
      });
      filterRows();
    }

    function filterRows() {
      const query = document.getElementById('search').value.toLowerCase().trim();
      const rows = document.querySelectorAll('.clickable-row');

      rows.forEach(row => {
        const build = row.getAttribute('data-build').toLowerCase();
        const commit = row.getAttribute('data-commit').toLowerCase();
        const status = row.getAttribute('data-status');

        const matchesQuery = build.includes(query) || commit.includes(query);
        const matchesFilter = currentFilter === 'all' || status === currentFilter;

        if (matchesQuery && matchesFilter) {
          row.style.display = 'table-row';
        } else {
          row.style.display = 'none';
        }
      });
    }
  </script>
</body>
</html>
  `;
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

main().catch(console.error);
