import { spawnSync } from 'node:child_process';

// A local, full-stack preview using the same server and database as production.
// Re-run after editing; this deliberately does not replace the authentication API.
const build = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { stdio: 'inherit', shell: process.platform === 'win32' });
if (build.status !== 0) process.exit(build.status || 1);
const portArg = process.argv.indexOf('--port');
const port = Number(portArg >= 0 ? process.argv[portArg + 1] : process.env.PORT || 3000);
const { createApp } = await import('../dist/server.mjs');
const app = await createApp();
app.server.listen(port, '0.0.0.0', () => console.log(`Classroom preview: http://127.0.0.1:${port}`));
const stop = () => { app.close(); process.exit(0); };
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
