import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.env.npm_execpath;
assert.ok(npm, 'Run through npm run verify:package to select the trusted npm CLI');
const receipt = JSON.parse(await readFile(join(root, 'SOURCE.json'), 'utf8'));
assert.match(receipt.sourceRevision, /^[0-9a-f]{40}$/);
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
assert.equal(manifest.dependencies['@manuelselch/pi-sdk'], '0.1.0');
assert.ok(!(manifest.bundleDependencies ?? []).includes('@manuelselch/pi-sdk'));
const directory = await mkdtemp(join(tmpdir(), 'pi server packed '));
const run = (args, cwd, options = {}) => execFileSync(process.execPath, args, {
  cwd, stdio: 'inherit', timeout: 120000, env: { ...process.env, NODE_PATH: '', PI_CODING_AGENT_DIR: join(directory, 'agent') }, ...options,
});
try {
  const result = JSON.parse(run([npm, 'pack', '--ignore-scripts', '--json', '--pack-destination', directory], root, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }))[0];
  assert.ok(!result.bundled.includes('@manuelselch/pi-sdk'), 'SDK must resolve from npm, not be bundled');
  for (const file of result.files) {
    assert.ok(!file.path.startsWith('src/'), 'Source leaked into compiled artifact');
    assert.ok(!file.path.includes('vendor/'), 'Local SDK file spec leaked as a runtime dependency');
  }
  await writeFile(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: {
    '@manuelselch/pi-server': './' + result.filename,
  } }));
  run([npm, 'install', '--ignore-scripts', '--no-audit', '--no-fund'], directory);
  const installedServer = JSON.parse(await readFile(join(directory, 'node_modules/@manuelselch/pi-server/package.json'), 'utf8'));
  assert.equal(installedServer.dependencies['@manuelselch/pi-sdk'], '0.1.0');
  const installedSdk = JSON.parse(await readFile(join(directory, 'node_modules/@manuelselch/pi-sdk/package.json'), 'utf8'));
  assert.equal(installedSdk.version, '0.1.0');
  const consumerLock = JSON.parse(await readFile(join(directory, 'package-lock.json'), 'utf8'));
  assert.match(consumerLock.packages['node_modules/@manuelselch/pi-sdk'].resolved, /^https:\/\/registry\.npmjs\.org\//);
  const require = createRequire(join(directory, 'consumer.mjs'));
  for (const name of ['react', 'vite', 'tsx']) assert.throws(() => require.resolve(name), name + ' unexpectedly installed');
  // These are the same behavioral scenarios, now using only documented installed exports/bin.
  for (const file of await readdir(join(root, 'test'))) {
    if (!file.endsWith('.mjs')) continue;
    let source = await readFile(join(root, 'test', file), 'utf8');
    source = source.replaceAll("'../dist/index.js'", "'@manuelselch/pi-server'")
      .replaceAll("'../dist/extensions.js'", "'@manuelselch/pi-server/extensions'")
      .replaceAll("'../dist/testing/index.js'", "'@manuelselch/pi-server/testing'")
      .replaceAll("new URL('../dist/cli.js', import.meta.url)", "new URL('./node_modules/.bin/pi-server', import.meta.url)")
      .replaceAll("new URL('../dist/testing/loopback.js', import.meta.url).href", "'@manuelselch/pi-server/testing/loopback'");
    await writeFile(join(directory, file), source);
  }
  run(['--test', ...((await readdir(directory)).filter(file => file.endsWith('.test.mjs')))], directory);
  await writeFile(join(directory, 'consumer.ts'), `import { createPiServer, createPiRuntimeAdapter, createRestartService, type PiServerOptions, type RuntimeAdapter, type FileLogger } from '@manuelselch/pi-server';
import { getPiChatExtensionRegistry, type PiChatExtensionRegistry } from '@manuelselch/pi-server/extensions';
import { FakeRuntimeAdapter, snapshotData } from '@manuelselch/pi-server/testing';
import { runLoopbackFixture } from '@manuelselch/pi-server/testing/loopback';
const options: PiServerOptions = { runtime: new FakeRuntimeAdapter(), extensions: getPiChatExtensionRegistry(), catalogue: { homeDirectory: null } };
const server = createPiServer(options); void server.httpServer; void server.close;
void createPiRuntimeAdapter; void createRestartService; void snapshotData; void runLoopbackFixture;
`);
  run([join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--skipLibCheck', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2023', 'consumer.ts'], directory);
  assert.throws(() => require.resolve('@manuelselch/pi-server/dist/transport/websocket-transport.js'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
  console.log('Verified compiled packed server exports, SDK initialization, CLI/restart/signals and loopback safety in an isolated consumer.');
} finally { await rm(directory, { recursive: true, force: true }); }
