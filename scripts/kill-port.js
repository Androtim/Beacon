#!/usr/bin/env node

const { exec } = require('child_process');
const port = process.argv[2] || '3001';

console.log(`🔍 Looking for processes on port ${port}...`);

// Try lsof first (Linux/Mac)
exec(`lsof -ti tcp:${port}`, (error, stdout, stderr) => {
  if (stdout) {
    const pids = stdout.trim().split('\n');
    console.log(`Found ${pids.length} process(es) on port ${port}`);
    
    pids.forEach(pid => {
      exec(`kill -9 ${pid}`, (killError) => {
        if (killError) {
          console.error(`❌ Failed to kill process ${pid}:`, killError.message);
        } else {
          console.log(`✅ Killed process ${pid}`);
        }
      });
    });
  } else {
    console.log(`✅ No processes found on port ${port}`);
  }
});