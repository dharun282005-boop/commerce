#!/usr/bin/env node
// Scans every git-tracked file for things that look like secrets (rule 6). Exit 1 on a finding.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PATTERNS = [
  ['Anthropic API key', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI-style key', /\bsk-[A-Za-z0-9]{32,}\b/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Private key block', /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Google auth key (AQ.)', /\bAQ\.[A-Za-z0-9_-]{20,}/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['Slack token', /\bxox[abpr]-[A-Za-z0-9-]{10,}\b/],
  [
    'Generic secret assignment',
    /\b(api[_-]?key|secret|password|token)\s*[:=]\s*['"][A-Za-z0-9/+_-]{24,}['"]/i,
  ],
];
// Known, deliberate development-only values (documented in docker-compose.yml / tests).
const ALLOW = [
  /cuc_dev_password/,
  /dev-only-alert-secret-change-me/,
  /test-admin-token-123/,
  /super-secret-token-123/,
];

const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const findings = [];
for (const f of files) {
  if (/\.(png|jpg|ico|woff2?|lock)$|package-lock\.json$/.test(f)) continue;
  let text;
  try {
    text = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  text.split('\n').forEach((line, i) => {
    for (const [name, re] of PATTERNS) {
      if (re.test(line) && !ALLOW.some((a) => a.test(line))) findings.push(`${f}:${i + 1}  ${name}`);
    }
  });
}
if (!files.includes('.env.example') || files.includes('.env'))
  findings.push('.env must be untracked and .env.example tracked');
if (findings.length) {
  console.error(`Possible secrets found:\n${findings.join('\n')}`);
  process.exit(1);
}
console.log(`secrets scan: ${files.length} tracked files, no findings`);
