const fs = require('fs');
let content = fs.readFileSync('src/context/ThemeContext.jsx', 'utf8');

const newInit = `  const [theme, setTheme] = useState(() => {
    // Check local storage or default to light
    const saved = localStorage.getItem('theme') || 'light';
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return saved;
  })`;

content = content.replace(/  const \[theme, setTheme\] = useState\(\(\) => \{[\s\S]*?\}\)/, newInit);
fs.writeFileSync('src/context/ThemeContext.jsx', content);
