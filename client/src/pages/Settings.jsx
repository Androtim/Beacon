import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ArrowLeft, User, Mail, Bell, Moon, Sun, LogOut } from 'lucide-react';
import '../index.css';

const Settings = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    if (user) {
      setName(user.username || user.name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  // Validation Test: Verify background and text colors on theme change
  const [testResult, setTestResult] = useState("Waiting for theme change...");
  
  useEffect(() => {
    const timer = setTimeout(() => {
      const bodyStyles = getComputedStyle(document.body);
      const bgColor = bodyStyles.backgroundColor;
      const textColor = bodyStyles.color;
      let status = "PASS";
      if (theme === 'dark') {
        if (!bgColor.includes('15, 23, 42') && !bgColor.includes('0f172a')) status = "FAIL (BG)";
        if (!textColor.includes('248, 250, 252') && !textColor.includes('f8fafc')) status = "FAIL (Text)";
      } else {
        if (!bgColor.includes('248, 250, 252') && !bgColor.includes('f8fafc')) status = "FAIL (BG)";
        if (!textColor.includes('15, 23, 42') && !textColor.includes('0f172a')) status = "FAIL (Text)";
      }
      
      setTestResult(`[${status}] Theme: ${theme} | BG: ${bgColor} | Text: ${textColor}`);
    }, 100);
    return () => clearTimeout(timer);
  }, [theme]);

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      <div className="max-w-2xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex items-center space-x-4">
          <Link to="/" className="p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-300" />
          </Link>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-sans tracking-tight">Settings</h2>
        </header>

        <main className="space-y-6">
          {/* Profile Section */}
          <section className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                <User className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Profile</h3>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-slate-400" />
                  </div>
                  <input 
                    type="text" 
                    className="pl-10 input-field w-full dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:placeholder-slate-500" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="Your Name"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400" />
                  </div>
                  <input 
                    type="email" 
                    className="pl-10 input-field w-full dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:placeholder-slate-500" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              <button className="btn btn-primary w-full mt-2">
                Update Profile
              </button>
            </div>
          </section>

          {/* Preferences Section */}
          <section className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Preferences</h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block font-medium text-slate-900 dark:text-white">Push Notifications</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">Receive alerts for new messages</span>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setNotifications(!notifications)}
                  className={`${notifications ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-600'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                >
                  <span className={`${notifications ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg">
                    {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  </div>
                  <div>
                    <span className="block font-medium text-slate-900 dark:text-white">Dark Mode</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">Toggle dark theme appearance</span>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={toggleTheme}
                  className={`${theme === 'dark' ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-600'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                >
                  <span className={`${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
                </button>
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/30 transition-all active:scale-[0.98] shadow-sm"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>

          {/* Validation Test Display */}
          <div className="mt-8 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-mono text-slate-600 dark:text-slate-400 text-center border border-slate-200 dark:border-slate-700">
            {testResult}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Settings;
