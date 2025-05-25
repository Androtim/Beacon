import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'
import FileShare from '../components/FileShare'
import { Plus, Video, Users, Share2, Settings, MessageSquare } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

export default function Home() {
  const { user, logout } = useAuth()
  const socket = useSocket()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('watch') // 'watch', 'files', or 'messages'
  const [partyCode, setPartyCode] = useState('')
  const [customCode, setCustomCode] = useState('')
  const [showCustomCode, setShowCustomCode] = useState(false)

  const createParty = () => {
    const code = customCode.trim() || Math.random().toString(36).substring(2, 8).toUpperCase()
    navigate(`/party/${code}`)
  }

  const joinParty = (e) => {
    if (e) e.preventDefault()
    if (partyCode.trim()) {
      navigate(`/party/${partyCode.trim()}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-primary-600 dark:text-white">Beacon</h1>
              </div>
              {/* Tab Navigation */}
              <div className="flex space-x-1">
                <button
                  onClick={() => setActiveTab('watch')}
                  className={`px-4 py-2 rounded-md font-medium transition-colors flex items-center space-x-2 ${
                    activeTab === 'watch'
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700'
                  }`}
                >
                  <Video className="h-4 w-4" />
                  <span>Watch Party</span>
                </button>
                <button
                  onClick={() => setActiveTab('files')}
                  className={`px-4 py-2 rounded-md font-medium transition-colors flex items-center space-x-2 ${
                    activeTab === 'files'
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700'
                  }`}
                >
                  <Share2 className="h-4 w-4" />
                  <span>File Transfer</span>
                </button>
                <Link
                  to="/messages"
                  className="px-4 py-2 rounded-md font-medium transition-colors flex items-center space-x-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Messages</span>
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700 dark:text-gray-300">Hello, {user?.username}</span>
              <Link to="/settings" className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <Settings className="h-5 w-5" />
              </Link>
              <button
                onClick={logout}
                className="btn-secondary"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Welcome to Beacon
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Watch videos together and share files instantly
            </p>
          </div>

          {/* Tab Content */}
          {activeTab === 'watch' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 border dark:border-gray-700">
                <div className="text-center">
                  <div className="mx-auto h-16 w-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                    <Plus className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Create Watch Party
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    Start a new watch party and invite friends to join
                  </p>
                  <div className="space-y-3">
                    {showCustomCode && (
                      <input
                        type="text"
                        placeholder="Custom party code (optional)"
                        className="input-field"
                        value={customCode}
                        onChange={(e) => setCustomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                        maxLength={8}
                      />
                    )}
                    <button
                      onClick={createParty}
                      className="w-full btn-primary"
                    >
                      Create Party {customCode && `(${customCode})`}
                    </button>
                    <button
                      onClick={() => setShowCustomCode(!showCustomCode)}
                      className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      {showCustomCode ? 'Hide custom code' : 'Use custom code'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 border dark:border-gray-700">
                <div className="text-center">
                  <div className="mx-auto h-16 w-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
                    <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Join Watch Party
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    Enter a party code to join friends
                  </p>
                  <form onSubmit={joinParty} className="space-y-3">
                    <input
                      type="text"
                      placeholder="Enter party code"
                      className="input-field"
                      value={partyCode}
                      onChange={(e) => setPartyCode(e.target.value.toUpperCase())}
                      onKeyPress={(e) => e.key === 'Enter' && joinParty(e)}
                    />
                    <button
                      type="submit"
                      disabled={!partyCode.trim()}
                      className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Join Party
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="max-w-4xl mx-auto">
              <FileShare socket={socket} />
            </div>
          )}

        </div>
      </main>
    </div>
  )
}