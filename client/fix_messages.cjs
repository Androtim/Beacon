const fs = require('fs');

let content = fs.readFileSync('src/pages/Messages.jsx', 'utf8');

// Replace inline colors with CSS variables or Tailwind classes if possible, but simplest is to modify the inline styles strings.
content = content.replace(/'white'/g, "'var(--bg-primary)'");
content = content.replace(/'#f8fafc'/g, "'var(--bg-secondary)'"); // slate-50 equivalent
content = content.replace(/'#f1f5f9'/g, "'var(--bg-secondary)'"); // slate-100 equivalent
content = content.replace(/'#1e293b'/g, "'var(--text-primary)'"); // slate-800 equivalent
content = content.replace(/'#0f172a'/g, "'var(--text-primary)'"); // slate-900 equivalent

// Also, the root div has height: 100vh. I'll just change the layout.
// Actually, let's fix the borders
content = content.replace(/borderRight: '1px solid var\(--border-color\)'/g, "borderRight: '1px solid var(--bg-secondary)'");
content = content.replace(/borderBottom: '1px solid var\(--border-color\)'/g, "borderBottom: '1px solid var(--bg-secondary)'");
content = content.replace(/borderBottom: '1px solid #f1f5f9'/g, "borderBottom: '1px solid var(--bg-secondary)'");
content = content.replace(/borderTop: '1px solid var\(--border-color\)'/g, "borderTop: '1px solid var(--bg-secondary)'");

// #eff6ff is blue-50, which is bad in dark mode. Let's make it a semi-transparent blue or just use a CSS var.
content = content.replace(/'#eff6ff'/g, "selectedUser?.id === conv.user.id ? 'var(--bg-secondary)' : 'transparent'"); // Wait, it already has conditional logic.
// Let's replace the whole condition
content = content.replace(/backgroundColor: selectedUser\?\.id === conv\.user\.id \? '#eff6ff' : 'transparent'/g, "backgroundColor: selectedUser?.id === conv.user.id ? 'var(--bg-secondary)' : 'transparent'");

// For the message bubble:
// backgroundColor: isMe ? '#2563eb' : 'white', color: isMe ? 'white' : '#1e293b'
// white -> var(--bg-primary)
content = content.replace(/backgroundColor: isMe \? '#2563eb' : 'var\(--bg-primary\)'/g, "backgroundColor: isMe ? '#2563eb' : 'var(--bg-secondary)'");
content = content.replace(/color: isMe \? 'var\(--bg-primary\)' : 'var\(--text-primary\)'/g, "color: isMe ? '#ffffff' : 'var(--text-primary)'"); // Keep the white text on blue bubble!

// Let's just write a custom script to carefully replace
fs.writeFileSync('src/pages/Messages.jsx', content);
