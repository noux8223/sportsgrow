import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = process.env.SPORTSGROW_BUILD_DIR ? resolve(process.env.SPORTSGROW_BUILD_DIR) : join(repo, 'dist');
const pilot = join(output, 'pilot');
const ops = join(output, 'ops');
const publicFiles = ['index.html', 'login.html', 'student.html', 'coach.html', 'academy.html', 'offline.html', 'manifest.json', 'sw.js', 'accept-invite.html', 'reset-password.html', 'pick-role.html'];
const publicDirs = ['css', 'images', 'icons', 'legal', 'js'];
const deny = ['p-haram', '김하람', 'ST-1001', 'player@sportsgrow.kr', 'grow1234', 'sportsgrow.demo.v1'];
const operationsUrl = process.env.SPORTSGROW_OPS_URL;
if (!operationsUrl || !/^https:\/\//.test(operationsUrl)) throw new Error('Set SPORTSGROW_OPS_URL to the HTTPS operations-console origin before building the pilot bundle.');

async function copyPublicBundle(target) {
  await mkdir(target, { recursive: true });
  for (const file of publicFiles) await cp(join(repo, file), join(target, file));
  for (const dir of publicDirs) await cp(join(repo, dir), join(target, dir), { recursive: true });
  await rm(join(target, 'js', 'auth.js'), { force: true });
  await rm(join(target, 'js', 'admin.js'), { force: true });
  await rm(join(target, 'js', 'demo-data.js'), { force: true });
  for (const file of ['app-shell.js', 'student.js', 'coach.js', 'academy.js']) await rm(join(target, 'js', file), { force: true });
  await rm(join(target, 'css', 'admin.css'), { force: true });
  await rm(join(target, 'css', 'app.css'), { force: true });
  await rm(join(target, 'images', 'player-haram-game.jpg'), { force: true });
  await rm(join(target, 'images', 'player-haram-portrait.png'), { force: true });
  await rm(join(target, 'js', 'env.example.js'), { force: true });
  const envTemplate = await readFile(join(repo, 'js', 'env.example.js'), 'utf8');
  await writeFile(join(target, 'js', 'env.js'), envTemplate.replace('operationsUrl: ""', `operationsUrl: ${JSON.stringify(operationsUrl.replace(/\/$/, ''))}`));
  await writeFile(join(target, 'js', 'deployment-mode.json'), JSON.stringify({ demoLogin: false }, null, 2) + '\n');
}

function removeDivByClass(html, className) {
  const classMatch = Array.from(html.matchAll(/\bclass=(["'])(.*?)\1/g)).find((match) => match[2].split(/\s+/).includes(className));
  if (!classMatch) return html;
  const start = html.lastIndexOf('<div', classMatch.index);
  if (start < 0) throw new Error(`Could not locate ${className} container`);
  const tokens = /<\/?div\b[^>]*>/gi;
  tokens.lastIndex = start;
  let depth = 0;
  let token;
  while ((token = tokens.exec(html))) {
    if (/^<\//.test(token[0])) depth -= 1;
    else if (!/\/\s*>$/.test(token[0])) depth += 1;
    if (depth === 0) return html.slice(0, start) + html.slice(tokens.lastIndex);
  }
  throw new Error(`Could not find end of ${className} container`);
}

function sanitizeHtml(html, { login = false, adminLogin = false, pilotBuild = false } = {}) {
  html = html.replace(/<script\s+src=["']js\/demo-data\.js["']\s+defer><\/script>\s*/g, '');
  html = html.replace(/<script\s+src=["']js\/(?:admin|app-shell|student|coach|academy)\.js["']\s+defer><\/script>\s*/g, '');
  html = html.replace(/<link\s+rel=["']stylesheet["']\s+href=["']css\/(?:app|admin)\.css["'][^>]*>\s*/g, '');
  html = html.replace(/<script\s+src=["']js\/auth\.js["']\s+defer><\/script>/g, login || adminLogin ? '<script src="js/auth-login-api.js" defer></script>' : '');
  if (login || adminLogin) html = removeDivByClass(html, 'demo-box');
  if (pilotBuild) {
    html = html.replace(/<link\s+rel=["']preconnect["']\s+href=["']https:\/\/cdn\.jsdelivr\.net["'][^>]*>\s*/gi, '');
    html = html.replace(/<link\s+rel=["']stylesheet["']\s+href=["']https:\/\/cdn\.jsdelivr\.net\/[^"']+\.css["'][^>]*>/gi, '<link rel="stylesheet" href="css/fonts/pretendard.css">');
    html = html.replaceAll('김하람', '선수 예시');
    html = html.replace(/<a\b[^>]*class=["']footer__admin["'][^>]*>[\s\S]*?<\/a>\s*/g, '');
    html = html.replace(/<body\b([^>]*)>/i, (_match, attrs) => `<body${attrs} data-deployment="pilot">`);
    html = html.replace('</head>', '<style>body[data-deployment="pilot"]>.app{display:none!important}</style></head>');
  }
  if (adminLogin) html = html.replace(/href=["']index\.html["']/g, 'href="admin-login.html"');
  return html;
}

function apiOnlyDashboard(html) {
  return html.replace(/<body\b([^>]*)>([\s\S]*?)<\/body>/i, (_match, attrs, body) => {
    const scripts = Array.from(body.matchAll(/<script\b[\s\S]*?<\/script>/gi), (script) => script[0]).join('\n');
    return `<body${attrs} data-deployment="pilot"><main class="sg-api-loading" role="status">Sports Grow 계정과 서버 데이터를 확인하고 있습니다.</main>${scripts}</body>`;
  });
}

async function readTree(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await readTree(path, base));
    else files.push({ path, relative: path.slice(base.length + 1) });
  }
  return files;
}

async function sanitizeBundle(target, pages, options) {
  for (const page of pages) {
    const path = join(target, page);
    const source = await readFile(path, 'utf8');
    let output = sanitizeHtml(source, {
      ...options,
      login: page === 'login.html',
      adminLogin: page === 'admin-login.html',
    });
    if (['student.html', 'coach.html', 'academy.html', 'admin.html'].includes(page)) output = apiOnlyDashboard(output);
    await writeFile(path, output);
  }
}

async function assertNoDemoSecrets(target) {
  for (const file of await readTree(target)) {
    const body = await readFile(file.path);
    const content = body.toString('utf8');
    const found = deny.find((marker) => content.includes(marker));
    if (found) throw new Error(`Pilot output contains forbidden demo marker "${found}" in ${file.relative}`);
    if (file.relative.startsWith('js/') && ['auth.js', 'admin.js', 'demo-data.js', 'env.example.js'].includes(file.relative.slice(3))) {
      throw new Error(`Pilot output contains excluded script ${file.relative}`);
    }
  }
}

async function writeCspHashes() {
  const hashes = new Set();
  for (const target of [pilot, ops]) {
    for (const file of await readTree(target)) {
      if (!file.relative.endsWith('.html')) continue;
      const html = await readFile(file.path, 'utf8');
      for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
        if (/\bsrc\s*=/.test(match[1]) || !match[2].trim()) continue;
        const digest = createHash('sha256').update(match[2], 'utf8').digest('base64');
        hashes.add(`'sha256-${digest}'`);
      }
    }
  }
  await writeFile(join(output, 'security-csp.auto.tfvars.json'), JSON.stringify({ csp_script_hashes: [...hashes].sort() }, null, 2) + '\n');
}

await rm(output, { recursive: true, force: true });
await copyPublicBundle(pilot);
await sanitizeBundle(pilot, publicFiles.filter((file) => file.endsWith('.html')), { pilotBuild: true });

await cp(pilot, ops, { recursive: true });
for (const file of ['admin.html', 'admin-login.html']) await cp(join(repo, file), join(ops, file));
await cp(join(repo, 'css', 'admin.css'), join(ops, 'css', 'admin.css'));
await sanitizeBundle(ops, ['admin.html', 'admin-login.html'], { pilotBuild: true });

await assertNoDemoSecrets(pilot);
await assertNoDemoSecrets(ops);
await writeCspHashes();
console.log(`Pilot bundle: ${pilot}`);
console.log(`Operations bundle: ${ops}`);
