const fs = require('fs');

const files = ['src/pages/WatchParty.jsx', 'src/pages/Messages.jsx'];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Replace bg-white
  content = content.replace(/bg-white/g, 'bg-[var(--bg-primary)]');
  
  // Replace bg-slate-50
  content = content.replace(/bg-slate-50/g, 'bg-[var(--bg-secondary)]');
  
  // Replace text-slate-900
  content = content.replace(/text-slate-900/g, 'text-[var(--text-primary)]');
  
  // Replace bg-slate-900 (used in buttons maybe)
  content = content.replace(/bg-slate-900/g, 'bg-[var(--text-primary)]');

  // Ensure text is readable in both themes: 
  // Add dark classes for borders and other text
  content = content.replace(/text-slate-500/g, 'text-slate-500 dark:text-slate-400');
  content = content.replace(/text-slate-400/g, 'text-slate-400 dark:text-slate-500');
  content = content.replace(/text-slate-800/g, 'text-slate-800 dark:text-slate-200');
  content = content.replace(/border-slate-200/g, 'border-slate-200 dark:border-slate-700');
  content = content.replace(/border-slate-100/g, 'border-slate-100 dark:border-slate-800');

  // Also replace text-white with a class that flips, or leave it if it's on a button that uses text-primary as background
  // Wait, if bg-[var(--text-primary)] is the button background, what is the button text color?
  // var(--bg-primary).
  content = content.replace(/text-white/g, 'text-[var(--bg-primary)]');

  fs.writeFileSync(file, content);
});

console.log('Replaced colors in WatchParty and Messages');
