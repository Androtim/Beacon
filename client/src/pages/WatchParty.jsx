import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWatchParty } from '../hooks/useWatchParty'
import VideoPlayer from '../components/VideoPlayer'
import ChatBox from '../components/ChatBox'
import VideoFileSharing from '../components/VideoFileSharing'
import { Users, Video, Wifi, WifiOff, Crown, Upload, Link as LinkIcon, Copy, Check, LogOut } from 'lucide-react'

export default function WatchParty() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const playerRef = useRef()
  const [videoUrl, setVideoUrl] = useState('')
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [videoSource, setVideoSource] = useState('url') // 'url' or 'file'
  const [copied, setCopied] = useState(false)
  const [localVideoUrl, setLocalVideoUrl] = useState(null) // For P2P blob URLs
  const [localVideoInfo, setLocalVideoInfo] = useState(null) // File info for P2P videos
  
  const {
    participants,
    isHost,
    messages,
    videoState,
    setVideoUrl: setSharedVideoUrl,
    playVideo,
    pauseVideo,
    seekVideo,
    sendMessage,
    connected,
    socket // Get the socket from useWatchParty that's already joined the room
  } = useWatchParty(id, user)
  

  // Handle video player events (only emit if user initiated the action)
  const [userInitiated, setUserInitiated] = useState(false)
  const [syncingFromRemote, setSyncingFromRemote] = useState(false)
  

  const handlePlay = (currentTime) => {
    // Only broadcast if not syncing from remote (to prevent loops)
    if (!syncingFromRemote) {
      playVideo(currentTime)
    }
  }

  const handlePause = (currentTime) => {
    // Only broadcast if not syncing from remote (to prevent loops)
    if (!syncingFromRemote) {
      pauseVideo(currentTime)
    }
  }

  const handleSeeked = (currentTime) => {
    // Only broadcast if not syncing from remote (to prevent loops)
    if (!syncingFromRemote) {
      seekVideo(currentTime)
    }
  }

  // Sync video state from other participants
  useEffect(() => {
    if (!playerRef.current) return

    const player = playerRef.current
    
    // Handle both Video.js, native video, and YouTube player APIs
    const getCurrentTime = () => {
      // Native video element
      if (typeof player.currentTime === 'number') {
        return player.currentTime
      }
      // Video.js
      if (player.currentTime && typeof player.currentTime === 'function') {
        return player.currentTime()
      }
      // YouTube
      if (player.getCurrentTime) {
        return player.getCurrentTime()
      }
      return 0
    }
    
    const setCurrentTime = (time) => {
      // Native video element
      if (typeof player.currentTime === 'number') {
        player.currentTime = time
      }
      // Video.js
      else if (player.currentTime && typeof player.currentTime === 'function') {
        player.currentTime(time)
      }
      // YouTube
      else if (player.seekTo) {
        player.seekTo(time)
      }
    }
    
    const isPlayerPaused = () => {
      // Native video element
      if (typeof player.paused === 'boolean') {
        return player.paused
      }
      // Video.js
      if (player.paused && typeof player.paused === 'function') {
        return player.paused()
      }
      // YouTube
      if (player.isPaused) {
        return player.isPaused()
      }
      return false
    }
    
    const playVideo = () => {
      if (player.play) {
        const playPromise = player.play()
        // Handle promise-based play for native video
        if (playPromise && playPromise.catch) {
          playPromise.catch(e => {})
        }
      }
    }
    
    const pauseVideo = () => {
      if (player.pause) {
        player.pause()
      }
    }

    const currentTime = getCurrentTime()
    const timeDiff = Math.abs(currentTime - videoState.currentTime)

    // Only sync if there's a significant time difference (> 1 second)
    if (timeDiff > 1) {
      setSyncingFromRemote(true)
      setCurrentTime(videoState.currentTime)
      setTimeout(() => setSyncingFromRemote(false), 100)
    }

    // Sync play/pause state
    if (videoState.isPlaying && isPlayerPaused()) {
      setSyncingFromRemote(true)
      playVideo()
      setTimeout(() => setSyncingFromRemote(false), 100)
    } else if (!videoState.isPlaying && !isPlayerPaused()) {
      setSyncingFromRemote(true)
      pauseVideo()
      setTimeout(() => setSyncingFromRemote(false), 100)
    }
  }, [videoState])

  const handleVideoUrlSubmit = (e) => {
    e.preventDefault()
    if (videoUrl.trim()) {
      setSharedVideoUrl(videoUrl.trim())
      setShowUrlInput(false)
      setVideoUrl('')
    }
  }

  const handlePlayerInteraction = () => {
    setUserInitiated(true)
  }

  const handleVideoFileReady = (url, fileInfo) => {
    // For P2P transfers, we need to set the URL locally without broadcasting
    // because blob URLs are local to each browser
    setLocalVideoUrl(url)
    setLocalVideoInfo(fileInfo)
    setVideoSource('file') // Ensure we're in file mode
    
    // Force a re-render by updating a dummy state
    setUserInitiated(prev => !prev)
  }

  const copyPartyCode = () => {
    navigator.clipboard.writeText(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const leaveParty = () => {
    // Navigate to home page
    navigate('/')
  }

  // Add error boundary check
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white flex items-center justify-center">
        <p>Please log in to join watch parties</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">Watch Party: {id}</h1>
                  <button
                    onClick={copyPartyCode}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    title="Copy party code"
                  >
                    {copied ? (
                      <Check size={20} className="text-green-500 dark:text-green-400" />
                    ) : (
                      <Copy size={20} />
                    )}
                  </button>
                </div>
                <p className="text-gray-600 dark:text-gray-400">Share this code with friends to invite them</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {connected ? (
                  <Wifi size={16} className="text-green-500 dark:text-green-400" />
                ) : (
                  <WifiOff size={16} className="text-red-500 dark:text-red-400" />
                )}
                <span className="text-sm">
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              {isHost && (
                <div className="flex items-center space-x-2">
                  <Crown size={16} className="text-yellow-500 dark:text-yellow-400" />
                  <span className="text-sm">Host</span>
                </div>
              )}
              <button
                onClick={leaveParty}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <LogOut size={16} />
                <span>Leave Party</span>
              </button>
            </div>
          </div>
        </div>

        {/* Video Source Selection (for hosts) */}
        {isHost && (
          <div className="mb-4 space-y-4">
            {/* Source Type Selector */}
            <div className="flex space-x-2">
              <button
                onClick={() => setVideoSource('url')}
                className={`px-4 py-2 rounded flex items-center space-x-2 transition-colors ${
                  videoSource === 'url' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                <LinkIcon size={16} />
                <span>Video URL</span>
              </button>
              <button
                onClick={() => setVideoSource('file')}
                className={`px-4 py-2 rounded flex items-center space-x-2 transition-colors ${
                  videoSource === 'file' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                <Upload size={16} />
                <span>Local File (P2P)</span>
              </button>
            </div>

            {/* URL Input */}
            {videoSource === 'url' && (
              <div>
                {!showUrlInput ? (
                  <button
                    onClick={() => setShowUrlInput(true)}
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded flex items-center space-x-2"
                  >
                    <Video size={16} />
                    <span>Set Video URL</span>
                  </button>
                ) : (
                  <form onSubmit={handleVideoUrlSubmit} className="flex space-x-2">
                    <input
                      type="url"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="Enter video URL (YouTube, MP4, etc.)"
                      className="flex-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
                    >
                      Set
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUrlInput(false)}
                      className="bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded"
                    >
                      Cancel
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Video Player */}
          <div className="lg:col-span-3">
            <div className="bg-black rounded-lg overflow-hidden">
              {(localVideoUrl || videoState.url) ? (
                <div onMouseDown={handlePlayerInteraction}>
                  <VideoPlayer
                    key={localVideoUrl || videoState.url} // Force re-render when URL changes
                    src={localVideoUrl || videoState.url}
                    playerRef={playerRef}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onSeeked={handleSeeked}
                    fileType={localVideoInfo?.type}
                  />
                </div>
              ) : (
                <div className="aspect-video flex items-center justify-center">
                  <div className="text-center">
                    <Video size={48} className="text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600 dark:text-gray-400">
                      {isHost 
                        ? "Click 'Set Video URL' to start watching" 
                        : "Waiting for host to set a video..."
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="space-y-4">
            {/* Participants */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Users size={16} />
                <h3 className="font-semibold">Participants ({participants.length})</h3>
              </div>
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div key={participant.id} className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full"></div>
                    <span className="text-sm">{participant.username}</span>
                    {participant.id === user.id && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">(You)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Chat */}
            <ChatBox messages={messages} onSendMessage={sendMessage} />
            
            {/* Video File Sharing - Always show for P2P transfers */}
            {socket && (
              <VideoFileSharing
                socket={socket}
                roomId={id}
                isHost={isHost}
                participants={participants}
                onVideoReady={handleVideoFileReady}
                hostVideoSource={videoSource}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}