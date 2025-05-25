import { Link } from 'react-router-dom'
import { ArrowLeft, Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'

export default function Settings() {
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto py-6 px-4">
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center text-primary-600 hover:text-primary-700">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Settings</h1>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Appearance</h3>
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  {theme === 'dark' ? (
                    <Moon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <Sun className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Theme</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Currently using {theme} mode
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleTheme}
                  className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 dark:bg-gray-600 transition-colors"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Account</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
                  <input 
                    type="text" 
                    className="input-field mt-1 dark:bg-gray-700 dark:text-white" 
                    value={user?.username || ''} 
                    readOnly 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                  <input 
                    type="email" 
                    className="input-field mt-1 dark:bg-gray-700 dark:text-white" 
                    value={user?.email || ''} 
                    readOnly 
                  />
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Preferences</h3>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input type="checkbox" className="mr-3" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Enable notifications</span>
                </label>
                <label className="flex items-center">
                  <input type="checkbox" className="mr-3" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Auto-join voice chat in parties</span>
                </label>
              </div>
            </div>
            
            <div className="pt-4">
              <button className="btn-primary">Save Changes</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}