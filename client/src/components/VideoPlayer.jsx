import { useEffect, useRef, useState } from 'react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'

// Helper function to detect video type
function getVideoType(src) {
  if (!src) return 'unknown'
  
  if (src.includes('youtube.com') || src.includes('youtu.be')) {
    return 'youtube'
  }
  
  if (src.startsWith('blob:') || src.startsWith('data:')) {
    return 'local'
  }
  
  const ext = src.split('.').pop()?.toLowerCase()
  if (['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(ext)) {
    return 'direct'
  }
  
  return 'unknown'
}

// Helper function to convert YouTube URL to embed
function getYouTubeEmbedUrl(url) {
  let videoId = ''
  
  if (url.includes('youtube.com/watch?v=')) {
    videoId = url.split('v=')[1]?.split('&')[0]
  } else if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1]?.split('?')[0]
  }
  
  return videoId ? `https://www.youtube.com/embed/${videoId}?enablejsapi=1&controls=1` : null
}

export default function VideoPlayer({ 
  src, 
  onReady,
  onPlay,
  onPause,
  onSeeked,
  onTimeUpdate,
  playerRef,
  fileType
}) {
  console.log('VideoPlayer component rendered with src:', src, 'fileType:', fileType)
  
  const videoRef = useRef()
  const iframeRef = useRef()
  const [videoType, setVideoType] = useState('unknown')
  const [error, setError] = useState(null)

  useEffect(() => {
    console.log('VideoPlayer useEffect triggered with src:', src, 'fileType:', fileType)
    if (!src) {
      console.log('No src provided to VideoPlayer')
      setVideoType('unknown')
      return
    }

    const type = getVideoType(src)
    console.log('Detected video type:', type, 'for src:', src)
    setVideoType(type)
    setError(null)

    if (type === 'youtube') {
      // Handle YouTube videos with iframe
      return
    }

    if (type === 'direct' || type === 'local') {
      // Handle direct video files with Video.js
      if (!videoRef.current) return

      // Clean up any existing player first
      if (playerRef && playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose()
        playerRef.current = null
      }

      const player = videojs(videoRef.current, {
        controls: true,
        responsive: true,
        fluid: true,
        playbackRates: [0.5, 1, 1.25, 1.5, 2],
        preload: 'auto'
      })

      // Store player reference
      if (playerRef) {
        playerRef.current = player
      }

      // Set up event listeners
      player.on('ready', () => {
        console.log('Player is ready')
        if (onReady) onReady(player)
      })

      player.on('play', () => {
        const currentTime = player.currentTime()
        console.log('Video played at:', currentTime)
        if (onPlay) onPlay(currentTime)
      })

      player.on('pause', () => {
        const currentTime = player.currentTime()
        console.log('Video paused at:', currentTime)
        if (onPause) onPause(currentTime)
      })

      player.on('seeked', () => {
        const currentTime = player.currentTime()
        console.log('Video seeked to:', currentTime)
        if (onSeeked) onSeeked(currentTime)
      })

      player.on('timeupdate', () => {
        const currentTime = player.currentTime()
        if (onTimeUpdate) onTimeUpdate(currentTime)
      })

      player.on('error', (e) => {
        console.error('Video player error:', e)
        setError('Failed to load video. Please check the URL or file format.')
      })

      // Set source with proper type detection
      try {
        let sourceType = 'video/mp4'
        
        // Use fileType if provided (from P2P transfers)
        if (fileType) {
          sourceType = fileType
        } else {
          // Otherwise detect from URL
          if (src.includes('.webm')) sourceType = 'video/webm'
          else if (src.includes('.mov')) sourceType = 'video/quicktime'
          else if (src.includes('.avi')) sourceType = 'video/x-msvideo'
          else if (src.startsWith('blob:')) {
            // For blob URLs, we'll assume mp4 unless we have more info
            sourceType = 'video/mp4'
          }
        }
        
        console.log('Setting video source:', src, 'type:', sourceType)
        player.src({ src, type: sourceType })
        
        // For blob URLs, we might need to load manually
        if (src.startsWith('blob:')) {
          player.load()
        }
      } catch (err) {
        console.error('Error setting video source:', err)
        setError('Invalid video source')
      }

      return () => {
        if (player && !player.isDisposed()) {
          player.dispose()
        }
      }
    }

    if (type === 'unknown') {
      setError('Unsupported video format. Please use direct video links (.mp4, .webm) or YouTube URLs.')
    }
  }, [src, fileType]) // Only re-initialize when src or fileType changes

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#121212] border border-red-500/20 font-mono">
        <div className="text-center p-8">
          <p className="text-red-500 text-xs font-black uppercase tracking-[0.2em] mb-4">!! ACCESS_DENIED !!</p>
          <p className="text-slate-500 text-[10px] uppercase font-bold">{error}</p>
        </div>
      </div>
    )
  }

  if (videoType === 'youtube') {
    const embedUrl = getYouTubeEmbedUrl(src)
    
    if (!embedUrl) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-[#121212] border border-red-500/20 font-mono">
          <div className="text-center p-8">
            <p className="text-red-500 text-xs font-black uppercase tracking-[0.2em]">INVALID_COORDINATES</p>
          </div>
        </div>
      )
    }

    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex-1">
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full grayscale-[0.5] contrast-[1.2]"
          />
        </div>
        <div className="bg-orange-500/5 border-t border-orange-500/20 p-4 font-mono">
          <p className="text-orange-500 text-[9px] font-black uppercase tracking-[0.1em] flex items-center gap-2">
            <span className="animate-pulse">⚠</span>
            <span>WARNING: PROTOCOL_RESTRICTION // YOUTUBE_IFRAME prevents P2P synchronization. Use direct links or local files for real-time sync.</span>
          </p>
        </div>
      </div>
    )
  }

  if (videoType === 'direct' || videoType === 'local') {
    console.log('Rendering video element for type:', videoType)
    
    // For blob URLs, use native video element with sync support
    if (src.startsWith('blob:')) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-black overflow-hidden rounded-[inherit]">
          <video
            ref={videoRef}
            controls
            playsInline
            autoPlay={false}
            className="w-full h-full object-contain"
            src={src}
            onLoadedMetadata={(e) => {
              console.log('Video metadata loaded')
              if (playerRef) {
                playerRef.current = e.target
              }
              if (onReady) onReady(e.target)
            }}
            onPlay={(e) => {
              console.log('Video played')
              if (onPlay) onPlay(e.target.currentTime)
            }}
            onPause={(e) => {
              console.log('Video paused')
              if (onPause) onPause(e.target.currentTime)
            }}
            onSeeked={(e) => {
              console.log('Video seeked')
              if (onSeeked) onSeeked(e.target.currentTime)
            }}
            onTimeUpdate={(e) => {
              if (onTimeUpdate) onTimeUpdate(e.target.currentTime)
            }}
            onError={(e) => console.error('Video error:', e)}
          />
        </div>
      )
    }
    
    return (
      <div className="w-full" key={src}>
        <video
          ref={videoRef}
          className="video-js vjs-default-skin w-full"
          data-setup="{}"
        />
      </div>
    )
  }

  console.log('VideoPlayer falling through to default render - videoType:', videoType, 'src:', src)
  
  return (
    <div className="w-full aspect-video bg-gray-800 flex items-center justify-center">
      <div className="text-center text-white">
        <p>No video loaded</p>
        <p className="text-sm text-gray-400 mt-2">Video type: {videoType}</p>
        <p className="text-sm text-gray-400">Source: {src ? 'Provided' : 'None'}</p>
      </div>
    </div>
  )
}