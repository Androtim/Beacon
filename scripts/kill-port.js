#!/usr/bin/env node

const { exec } = require('child_process');
const port = process.argv[2] || '3001';

// lsof-based, so Linux/Mac only; on Windows kill the process manually.
exec(`lsof -ti tcp:${port}`, (error, stdout) => {
  if (!stdout) {
    console.log(`no processes found on port ${port}`);
    return;
  }
  const pids = stdout.trim().split('\n');
  pids.forEach(pid => {
    exec(`kill -9 ${pid}`, (killError) => {
      if (killError) {
        console.error(`failed to kill ${pid}:`, killError.message);
      } else {
        console.log(`killed ${pid} (port ${port})`);
      }
    });
  });
});
