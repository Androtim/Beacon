import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, Radio, Settings, LogOut, ShieldAlert } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

const Layout = ({ children }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();

  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  if (isAuthPage) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#070a12] flex items-center justify-center">
        {/* Glow decoration for Auth pages */}
        <div className="orb w-[450px] h-[450px] bg-indigo-600/20 top-[-150px] left-[-100px] blur-[140px]" />
        <div className="orb w-[450px] h-[450px] bg-purple-600/20 bottom-[-150px] right-[-100px] blur-[140px]" />
        
        <div className="absolute top-6 right-6 z-50">
          <button
            onClick={toggleTheme}
            className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition-all shadow-md backdrop-blur-md active:scale-95"
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
        
        <div className="relative z-10 w-full flex justify-center p-4">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden transition-colors duration-300">
      {/* Dynamic background glowing orbs */}
      <div className="orb w-[350px] h-[350px] bg-blue-500/10 dark:bg-indigo-500/10 top-[-100px] left-[-50px] blur-[120px]" />
      <div className="orb w-[300px] h-[300px] bg-purple-500/10 dark:bg-purple-600/10 bottom-[100px] right-[-50px] blur-[120px]" />
      
      {/* Header */}
      <header className="h-16 border-b border-slate-200/60 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl sticky top-0 z-50 transition-colors duration-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          
          <Link to="/" className="flex items-center gap-3 group">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300">
              <Radio size={18} className="fill-current animate-pulse" />
            </div>
            <span className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              Beacon<span className="text-blue-500 dark:text-indigo-400">.</span>
            </span>
          </Link>
          
          <div className="flex items-center gap-3.5">
            {user && (
              <>
                {/* Operator info panel */}
                <div className="hidden sm:block text-right pr-4 border-r border-slate-200 dark:border-slate-800">
                  <div className="text-[9px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-widest">Operator</div>
                  <div className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">{user.username}</div>
                </div>
                
                {/* Settings Button */}
                <Link 
                  to="/settings" 
                  className="p-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-all active:scale-95 border border-transparent hover:border-slate-200/50 dark:hover:border-slate-800"
                  title="System Settings"
                >
                  <Settings size={18} />
                </Link>
                
                {/* Terminate Session Button */}
                <button 
                  onClick={logout} 
                  className="p-2.5 text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/20 rounded-xl transition-all active:scale-95 border border-transparent"
                  title="Sign Out"
                >
                  <LogOut size={18} />
                </button>
              </>
            )}

            {/* Dark/Light mode switcher */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 dark:text-slate-350 hover:text-slate-700 dark:hover:text-white transition-all shadow-sm active:scale-95 border border-slate-200/40 dark:border-slate-700/60"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Main workspace */}
      <main className="flex-1 w-full relative z-10">
        {children}
      </main>
    </div>
  );
};

export default Layout;
