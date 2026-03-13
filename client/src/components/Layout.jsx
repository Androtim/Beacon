import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, Radio, Settings, LogOut } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const Layout = ({ children }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();

  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  if (isAuthPage) {
    return (
      <div className="relative min-h-screen">
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="bg-blue-600 text-white p-2 rounded-xl shadow-lg shadow-blue-600/20 group-hover:scale-105 transition-transform">
              <Radio size={20} className="fill-current" />
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Beacon</span>
          </Link>
          
          <div className="flex items-center gap-4">
            {user && (
              <>
                <div className="hidden sm:block text-right pr-4 border-r border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Operator</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{user.username}</div>
                </div>
                <Link to="/settings" className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all">
                  <Settings size={20} />
                </Link>
                <button 
                  onClick={logout} 
                  className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all"
                  title="Sign Out"
                >
                  <LogOut size={20} />
                </button>
              </>
            )}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 w-full">
        {children}
      </main>
    </div>
  );
};

export default Layout;
