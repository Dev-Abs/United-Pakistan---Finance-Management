const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');

function run(label, command, args) {
  process.stdout.write(`\n[release] ${label}\n`);
  const executable = command === npmCommand && process.platform === 'win32'
    ? process.execPath
    : command;
  const executableArgs = command === npmCommand && process.platform === 'win32'
    ? [npmCli, ...args]
    : args;
  const result = spawnSync(executable, executableArgs, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

function serverFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return serverFiles(file);
    return entry.name.endsWith('.js') ? [file] : [];
  });
}

try {
  run('Node test suite', npmCommand, ['test']);
  run('Production dependency audit', npmCommand, ['audit', '--omit=dev']);
  for (const file of serverFiles(path.join(root, 'server'))) {
    run(`Syntax: ${path.relative(root, file)}`, process.execPath, ['--check', file]);
  }

  if (process.env.VERIFY_LIVE === 'true') {
    if (process.env.DATABASE_RLS_ROLE !== 'authenticated') {
      throw new Error('VERIFY_LIVE=true requires DATABASE_RLS_ROLE=authenticated');
    }
    run('Live RLS role preflight', npmCommand, ['run', 'db:check-rls-role']);
    run('Live RLS isolation smoke', npmCommand, ['run', 'smoke:rls']);
    run('Live auth/role smoke', npmCommand, ['run', 'smoke:phase2']);
  } else {
    process.stdout.write('\n[release] Live checks skipped; set VERIFY_LIVE=true with DATABASE_RLS_ROLE=authenticated to run them.\n');
  }
  process.stdout.write('\n[release] Verification passed.\n');
} catch (error) {
  process.stderr.write(`\n[release] Verification failed: ${error.message}\n`);
  process.exitCode = 1;
}
