import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ArrowLeft, User, Mail, Bell, Moon, Sun, LogOut, ShieldCheck } from 'lucide-react';
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
      
      // Adapted verification boundaries to include the new custom HSL premium palette
      if (theme === 'dark') {
        const isDarkBG = bgColor.includes('11, 15, 25') || bgColor.includes('0b0f19') || bgColor.includes('15, 23, 42') || bgColor.includes('0f172a');
        if (!isDarkBG) status = "FAIL (BG)";
        if (!textColor.includes('245, 245, 247') && !textColor.includes('f5f5f7') && !textColor.includes('248, 250, 252') && !textColor.includes('f8fafc')) status = "FAIL (Text)";
      } else {
        const isLightBG = bgColor.includes('251, 251, 253') || bgColor.includes('fbfbfd') || bgColor.includes('248, 250, 252') || bgColor.includes('f8fafc');
        if (!isLightBG) status = "FAIL (BG)";
        if (!textColor.includes('29, 29, 31') && !textColor.includes('1d1d1f') && !textColor.includes('15, 23, 42') && !textColor.includes('0f172a')) status = "FAIL (Text)";
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
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex items-center space-x-4">
          <Link to="/" className="p-2.5 rounded-xl glass-card hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-350" />
          </Link>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">System Settings</h2>
        </header>

        <main className="space-y-6">
          {/* Profile Section */}
          <section className="glass-card p-6 border border-slate-200/50 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                <User className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Profile Manifest</h3>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Operator Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-slate-450 dark:text-slate-500" />
                  </div>
                  <input 
                    type="text" 
                    className="pl-10 input-field" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="Operator ID"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Secure Routing Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-450 dark:text-slate-500" />
                  </div>
                  <input 
                    type="email" 
                    className="pl-10 input-field" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="operator@beacon.sec"
                  />
                </div>
              </div>

              <button className="btn btn-primary w-full mt-2 h-11 text-xs uppercase tracking-wider">
                Sync Profile Updates
              </button>
            </div>
          </section>

          {/* Preferences Section */}
          <section className="glass-card p-6 border border-slate-200/50 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">System Parameters</h3>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-100 dark:bg-slate-800/80 text-slate-550 dark:text-slate-400 rounded-xl">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Alerts System</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">Enable real-time notification warnings</span>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setNotifications(!notifications)}
                  className={`${notifications ? 'bg-blue-650 dark:bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
                >
                  <span className={`${notifications ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-slate-900 shadow ring-0 transition duration-200 ease-in-out`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-100 dark:bg-slate-800/80 text-slate-550 dark:text-slate-400 rounded-xl">
                    {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Dark Theme Mode</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">Toggle dark room interface</span>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={toggleTheme}
                  className={`${theme === 'dark' ? 'bg-blue-650 dark:bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
                >
                  <span className={`${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-slate-900 shadow ring-0 transition duration-200 ease-in-out`} />
                </button>
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-3 h-11 rounded-xl font-bold text-xs uppercase tracking-wider text-rose-500 bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/10 dark:hover:bg-rose-500/25 transition-all active:scale-[0.98]"
          >
            <LogOut className="w-4.5 h-4.5" />
            Terminate Routing Session
          </button>

          {/* Validation Test Display */}
          <div className="mt-8 p-3.5 bg-slate-100 dark:bg-slate-900/60 rounded-xl text-[10px] font-mono text-slate-400 dark:text-slate-500 text-center border border-slate-200/50 dark:border-slate-850">
            {testResult}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Settings;
