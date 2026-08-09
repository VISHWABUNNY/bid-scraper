const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const root = path.resolve(__dirname, '..');
const backendDir = path.join(root, 'backend');
const frontendDir = path.join(root, 'frontend');

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/health' }, (res) => {
      res.resume();
      resolve(true);
    });

    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  const backendRunning = await checkPort(5000);
  const frontendRunning = await checkPort(5173);

  const backendArgs = backendRunning ? [] : ['run', 'dev'];
  const frontendArgs = frontendRunning ? [] : ['run', 'dev', '--', '--host', '0.0.0.0'];

  if (!backendRunning) {
    console.log('Starting backend...');
  } else {
    console.log('Backend already running on port 5000');
  }

  if (!frontendRunning) {
    console.log('Starting frontend...');
  } else {
    console.log('Frontend already running on port 5173');
  }

  if (!backendRunning) {
    const backend = spawn('npm', backendArgs, {
      cwd: backendDir,
      shell: true,
      stdio: 'inherit',
    });

    backend.on('exit', (code) => {
      if (code !== 0) {
        console.error('Backend exited unexpectedly');
      }
    });
  }

  if (!frontendRunning) {
    const frontend = spawn('npm', frontendArgs, {
      cwd: frontendDir,
      shell: true,
      stdio: 'inherit',
    });

    frontend.on('exit', (code) => {
      if (code !== 0) {
        console.error('Frontend exited unexpectedly');
      }
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
