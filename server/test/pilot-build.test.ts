import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const serverDir = resolve(new URL('..', import.meta.url).pathname);

async function filesUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : Promise.resolve([path]);
  }));
  return nested.flat();
}

test('pilot bundles omit demo identity, demo data scripts, and operations pages from the public output', async () => {
  const output = await mkdtemp(join(tmpdir(), 'sportsgrow-pilot-build-'));
  try {
    execFileSync(process.execPath, ['scripts/build-pilot.mjs'], {
      cwd: serverDir,
      env: { ...process.env, SPORTSGROW_BUILD_DIR: output, SPORTSGROW_OPS_URL: 'https://ops.sportsgrow.test' },
      stdio: 'pipe',
    });
    const pilot = join(output, 'pilot');
    const ops = join(output, 'ops');
    const pilotPaths = await filesUnder(pilot);
    const pilotText = (await Promise.all(pilotPaths.map((path) => readFile(path)))).map((buffer) => buffer.toString('utf8')).join('\n');

    for (const marker of ['p-haram', '김하람', 'ST-1001', 'player@sportsgrow.kr', 'grow1234', 'sportsgrow.demo.v1']) assert.equal(pilotText.includes(marker), false, `pilot contains ${marker}`);
    for (const file of ['js/auth.js', 'js/admin.js', 'js/demo-data.js', 'js/student.js', 'js/coach.js', 'js/academy.js', 'admin.html', 'admin-login.html']) {
      await assert.rejects(stat(join(pilot, file)));
    }
    await stat(join(ops, 'admin.html'));
    await stat(join(ops, 'admin-login.html'));
    await stat(join(pilot, 'css/fonts/PretendardVariable.woff2'));
    await stat(join(pilot, 'css/fonts/OFL.txt'));
    assert.match(await readFile(join(pilot, 'js/env.js'), 'utf8'), /https:\/\/ops\.sportsgrow\.test/);
    assert.match(await readFile(join(pilot, 'js/deployment-mode.json'), 'utf8'), /"demoLogin": false/);
    assert.match(await readFile(join(pilot, 'student.html'), 'utf8'), /api-dashboard\.js/);
    assert.match(await readFile(join(pilot, 'index.html'), 'utf8'), /css\/fonts\/pretendard\.css/);
    assert.doesNotMatch(pilotText, /cdn\.jsdelivr\.net/);
    const cspVars = JSON.parse(await readFile(join(output, 'security-csp.auto.tfvars.json'), 'utf8')) as { csp_script_hashes: string[] };
    assert.ok(cspVars.csp_script_hashes.length > 0);
    assert.ok(cspVars.csp_script_hashes.every((hash) => /^'sha256-[A-Za-z0-9+/]+=*'$/.test(hash)));
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
