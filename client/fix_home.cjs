const fs = require('fs');
let content = fs.readFileSync('src/pages/Home.jsx', 'utf8');

// The nav block starts at <nav className="flex items-center justify-between h-20 border-b border-slate-200/60 mb-8">
// and ends at </nav>
// Let's replace the whole <nav>...</nav> with just the tab buttons.

const navRegex = /<nav className="flex items-center justify-between h-20 border-b border-slate-200\/60 mb-8">[\s\S]*?<\/nav>/;

const replacement = `<div className="flex justify-center md:justify-start mb-8">
            <div className="flex bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <button 
                onClick={() => setActiveTab('watch')}
                className={\`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 \${
                  activeTab === 'watch' 
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                }\`}
              >
                <Tv size={16} />
                Watch Party
              </button>
              <button 
                onClick={() => setActiveTab('files')}
                className={\`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 \${
                  activeTab === 'files' 
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                }\`}
              >
                <FolderOpen size={16} />
                File Share
              </button>
            </div>
          </div>`;

content = content.replace(navRegex, replacement);

// Also replace hardcoded colors in Home.jsx
content = content.replace(/text-slate-900/g, 'text-[var(--text-primary)]');
content = content.replace(/text-slate-500/g, 'text-slate-500 dark:text-slate-400');
content = content.replace(/bg-slate-900/g, 'bg-slate-900 dark:bg-slate-100');
content = content.replace(/text-white/g, 'text-white dark:text-slate-900');
content = content.replace(/bg-white/g, 'bg-white dark:bg-slate-900');

fs.writeFileSync('src/pages/Home.jsx', content);
