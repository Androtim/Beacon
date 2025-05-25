import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, Download, Copy, Check, X, FileIcon, Share2, Loader } from 'lucide-react'
import SimplePeer from 'simple-peer'
import JSZip from 'jszip'

export default function FileShare({ socket }) {
  const [mode, setMode] = useState('idle') // idle, sharing, receiving
  const [shareCode, setShareCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [sharingStatus, setSharingStatus] = useState('idle') // idle, waiting, transferring, complete, error
  const [downloadProgress, setDownloadProgress] = useState({})
  const [uploadProgress, setUploadProgress] = useState({})
  const [copied, setCopied] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [peerId, setPeerId] = useState(null)
  
  const fileInputRef = useRef(null)
  const peersRef = useRef({})
  const filesRef = useRef({})
  const chunksRef = useRef({})

  // Generate random 8-digit code
  const generateShareCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase()
  }

  // Send file via WebRTC
  const sendFile = useCallback(async (peer, file, fileIndex) => {
    const reader = new FileReader()
    reader.onload = async () => {
      const chunks = []
      const chunkSize = 64 * 1024 // 64KB chunks for better performance
      const buffer = reader.result
      
      for (let i = 0; i < buffer.byteLength; i += chunkSize) {
        chunks.push(buffer.slice(i, i + chunkSize))
      }

      console.log(`Sending file ${file.name}: ${chunks.length} chunks`)
      
      // Send file metadata first
      peer.send(JSON.stringify({
        type: 'file-meta',
        fileIndex,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        totalChunks: chunks.length
      }))
      
      // Send chunks with flow control
      for (let index = 0; index < chunks.length; index++) {
        try {
          const chunk = chunks[index]
          const message = JSON.stringify({
            type: 'file-chunk',
            fileIndex,
            data: Array.from(new Uint8Array(chunk)),
            index,
            total: chunks.length
          })
          
          // Wait for buffer to be ready
          while (peer._channel && peer._channel.bufferedAmount > 65536) {
            await new Promise(resolve => setTimeout(resolve, 50))
          }
          
          peer.send(message)
          
          // Update upload progress
          const progress = Math.round(((index + 1) / chunks.length) * 100)
          setUploadProgress(prev => ({ ...prev, [file.name]: progress }))
          
          // Small delay every 100 chunks
          if (index % 100 === 0) {
            await new Promise(resolve => setTimeout(resolve, 10))
          }
        } catch (err) {
          console.error(`Error sending chunk ${index}:`, err)
        }
      }

      // Send complete message
      await new Promise(resolve => setTimeout(resolve, 100))
      peer.send(JSON.stringify({ 
        type: 'file-complete', 
        fileIndex,
        fileName: file.name 
      }))
      console.log(`File transfer complete: ${file.name}`)
    }
    reader.readAsArrayBuffer(file)
  }, [])

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    // Check total size (limit to 3GB total)
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    if (totalSize > 3 * 1024 * 1024 * 1024) {
      alert('Total file size must be less than 3GB')
      return
    }

    setSelectedFiles(files)
    filesRef.current = files
    
    // Generate share code and notify server
    const code = generateShareCode()
    setShareCode(code)
    setMode('sharing')
    setSharingStatus('waiting')
    
    // Create file share on server
    socket.emit('file-share-create', {
      code,
      files: files.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type
      }))
    })
    
    // Reset file input
    e.target.value = null
  }

  // Join file share with code
  const joinFileShare = () => {
    if (!inputCode.trim() || inputCode.length !== 8) {
      alert('Please enter a valid 8-character share code')
      return
    }

    console.log('Joining file share with code:', inputCode.toUpperCase())
    setMode('receiving')
    setSharingStatus('waiting')
    
    // Request file info from server
    socket.emit('file-share-join', { code: inputCode.toUpperCase() })
  }

  // Copy share code
  const copyShareCode = () => {
    navigator.clipboard.writeText(shareCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Cancel transfer
  const cancelTransfer = () => {
    // Close all peer connections
    Object.values(peersRef.current).forEach(peer => {
      if (peer && !peer.destroyed) {
        peer.destroy()
      }
    })
    peersRef.current = {}
    
    // Reset state
    setMode('idle')
    setSharingStatus('idle')
    setShareCode('')
    setInputCode('')
    setSelectedFiles([])
    setPendingFiles([])
    setDownloadProgress({})
    setUploadProgress({})
    chunksRef.current = {}
    
    // Notify server
    if (shareCode) {
      socket.emit('file-share-cancel', { code: shareCode })
    }
  }

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Socket event handlers
  useEffect(() => {
    if (!socket) {
      console.log('⚠️ FileShare: No socket available')
      return
    }
    console.log('🔌 FileShare: Socket connected, setting up listeners')

    // File share info received (for receiver)
    const handleFileShareInfo = ({ files, hostId, code }) => {
      console.log('Received file share info:', files)
      setPendingFiles(files)
      setPeerId(hostId)
      setSharingStatus('ready')
    }

    // File share request received (for sender)
    const handleFileShareRequest = ({ from, fileInfo }) => {
      console.log('Received file share request from:', from)
      
      const peer = new SimplePeer({ initiator: false })
      peersRef.current[from] = peer

      peer.on('signal', signal => {
        socket.emit('file-share-signal', { to: from, signal })
      })

      peer.on('connect', async () => {
        console.log('Connected to peer for file sharing')
        setSharingStatus('transferring')
        
        // Send all files
        for (let i = 0; i < filesRef.current.length; i++) {
          await sendFile(peer, filesRef.current[i], i)
        }
        
        setSharingStatus('complete')
      })

      peer.on('error', err => {
        console.error('Peer error:', err)
        setSharingStatus('error')
      })
      
      // Send ready signal
      socket.emit('file-share-ready', { to: from, fileInfo: filesRef.current })
    }

    // File share ready (for receiver)
    const handleFileShareReady = ({ from, fileInfo }) => {
      console.log('Host is ready to send files')
      
      const peer = new SimplePeer({ initiator: true })
      peersRef.current[from] = peer
      chunksRef.current = {}

      peer.on('signal', signal => {
        socket.emit('file-share-signal', { to: from, signal })
      })

      peer.on('data', data => {
        try {
          const message = JSON.parse(data.toString())
          
          if (message.type === 'file-meta') {
            console.log('Received file metadata:', message)
            chunksRef.current[message.fileIndex] = {
              fileName: message.fileName,
              fileSize: message.fileSize,
              fileType: message.fileType,
              totalChunks: message.totalChunks,
              chunks: []
            }
            setDownloadProgress(prev => ({ ...prev, [message.fileName]: 0 }))
          }
          else if (message.type === 'file-chunk') {
            const fileData = chunksRef.current[message.fileIndex]
            if (fileData) {
              fileData.chunks[message.index] = new Uint8Array(message.data)
              const progress = Math.round(((message.index + 1) / message.total) * 100)
              setDownloadProgress(prev => ({ ...prev, [fileData.fileName]: progress }))
            }
          }
          else if (message.type === 'file-complete') {
            const fileData = chunksRef.current[message.fileIndex]
            if (fileData) {
              // Store completed file data
              fileData.blob = new Blob(fileData.chunks, { type: fileData.fileType })
              console.log(`File ready: ${fileData.fileName}`)
            }
            
            // Check if all files are complete
            const allFilesData = Object.values(chunksRef.current)
            const allComplete = allFilesData.length > 0 && allFilesData.every(
              file => file.blob !== undefined
            )
            
            if (allComplete) {
              setSharingStatus('complete')
              
              // If multiple files, create a zip
              if (allFilesData.length > 1) {
                console.log('Creating zip file for multiple files...')
                const zip = new JSZip()
                
                // Add all files to zip
                allFilesData.forEach(file => {
                  zip.file(file.fileName, file.blob)
                })
                
                // Generate zip and download
                zip.generateAsync({ type: 'blob' }).then(zipBlob => {
                  const url = URL.createObjectURL(zipBlob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `files_${shareCode || inputCode}.zip`
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                  setTimeout(() => URL.revokeObjectURL(url), 100)
                  console.log('Zip file downloaded')
                })
              } else {
                // Single file - download directly
                const file = allFilesData[0]
                const url = URL.createObjectURL(file.blob)
                const a = document.createElement('a')
                a.href = url
                a.download = file.fileName
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                setTimeout(() => URL.revokeObjectURL(url), 100)
                console.log(`Single file downloaded: ${file.fileName}`)
              }
            }
          }
        } catch (err) {
          console.error('Error processing peer data:', err)
        }
      })

      peer.on('connect', () => {
        console.log('Connected to host')
        setSharingStatus('transferring')
      })

      peer.on('error', err => {
        console.error('Peer error:', err)
        setSharingStatus('error')
      })
    }

    // Signal handling
    const handleSignal = ({ from, signal }) => {
      if (peersRef.current[from]) {
        peersRef.current[from].signal(signal)
      }
    }

    // Error handling
    const handleFileShareError = ({ message }) => {
      alert(message)
      setSharingStatus('error')
    }

    // Add listeners
    socket.on('file-share-info', handleFileShareInfo)
    socket.on('file-share-request', handleFileShareRequest)
    socket.on('file-share-ready', handleFileShareReady)
    socket.on('file-share-signal', handleSignal)
    socket.on('file-share-error', handleFileShareError)

    return () => {
      socket.off('file-share-info', handleFileShareInfo)
      socket.off('file-share-request', handleFileShareRequest)
      socket.off('file-share-ready', handleFileShareReady)
      socket.off('file-share-signal', handleSignal)
      socket.off('file-share-error', handleFileShareError)
    }
  }, [socket, sendFile, downloadProgress])

  // Start download
  const startDownload = () => {
    if (!peerId) return
    setSharingStatus('waiting')
    socket.emit('file-share-request', { to: peerId })
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Share2 className="h-6 w-6 text-blue-400" />
        <h2 className="text-xl font-semibold text-white">P2P File Transfer</h2>
      </div>

      {mode === 'idle' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Send Files */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Send Files
              </h3>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Select Files to Share
              </button>
              <p className="text-xs text-gray-400 mt-2">
                Max 3GB total, multiple files supported
              </p>
            </div>

            {/* Receive Files */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                <Download className="h-4 w-4" />
                Receive Files
              </h3>
              <form onSubmit={(e) => { e.preventDefault(); if (inputCode.length === 8) joinFileShare(); }}>
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="Enter 8-digit code"
                  maxLength={8}
                  className="w-full bg-gray-600 text-white px-3 py-2 rounded mb-2 uppercase"
                />
                <button
                  type="submit"
                  disabled={inputCode.length !== 8}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Connect
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {mode === 'sharing' && (
        <div className="space-y-4">
          {/* Share Code Display */}
          <div className="bg-gray-700 rounded-lg p-6 text-center">
            <p className="text-gray-400 mb-2">Share this code:</p>
            <div className="flex items-center justify-center gap-3">
              <p className="text-3xl font-mono font-bold text-white">{shareCode}</p>
              <button
                onClick={copyShareCode}
                className="p-2 bg-gray-600 hover:bg-gray-500 rounded transition-colors"
              >
                {copied ? <Check className="h-5 w-5 text-green-400" /> : <Copy className="h-5 w-5 text-white" />}
              </button>
            </div>
          </div>

          {/* Selected Files */}
          <div className="bg-gray-700 rounded-lg p-4">
            <h3 className="text-white font-medium mb-3">Selected Files:</h3>
            <div className="space-y-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-600 rounded p-2">
                  <div className="flex items-center gap-2">
                    <FileIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-white text-sm">{file.name}</span>
                  </div>
                  <span className="text-gray-400 text-sm">{formatFileSize(file.size)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Status */}
          {sharingStatus === 'waiting' && (
            <p className="text-center text-gray-400">Waiting for recipient to connect...</p>
          )}
          
          {sharingStatus === 'transferring' && (
            <div className="space-y-2">
              <p className="text-center text-blue-400 mb-3">Transferring files...</p>
              {Object.entries(uploadProgress).map(([fileName, progress]) => (
                <div key={fileName} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-white">{fileName}</span>
                    <span className="text-gray-400">{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {sharingStatus === 'complete' && (
            <div className="text-center text-green-400">
              <Check className="h-12 w-12 mx-auto mb-2" />
              <p>Transfer complete!</p>
            </div>
          )}

          <button
            onClick={cancelTransfer}
            className={`w-full text-white px-4 py-2 rounded-lg transition-colors ${
              sharingStatus === 'complete' 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {sharingStatus === 'complete' ? 'Done' : 'Cancel'}
          </button>
        </div>
      )}

      {mode === 'receiving' && (
        <div className="space-y-4">
          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-gray-400 mb-2">{sharingStatus === 'waiting' ? 'Connecting to share code:' : 'Connected to share code:'}</p>
            <p className="text-2xl font-mono font-bold text-white text-center">{inputCode}</p>
          </div>

          {sharingStatus === 'waiting' && (
            <p className="text-center text-gray-400">
              <Loader className="h-5 w-5 animate-spin inline mr-2" />
              Waiting for connection...
            </p>
          )}

          {sharingStatus === 'ready' && pendingFiles.length > 0 && (
            <div className="space-y-3">
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-white font-medium mb-3">Files to receive:</h3>
                <div className="space-y-2">
                  {pendingFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-600 rounded p-2">
                      <div className="flex items-center gap-2">
                        <FileIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-white text-sm">{file.name}</span>
                      </div>
                      <span className="text-gray-400 text-sm">{formatFileSize(file.size)}</span>
                    </div>
                  ))}
                </div>
                {pendingFiles.length > 1 && (
                  <p className="text-xs text-blue-400 mt-3 flex items-center gap-1">
                    <FileIcon className="h-3 w-3" />
                    Multiple files will be downloaded as a zip archive
                  </p>
                )}
              </div>
              
              <button
                onClick={startDownload}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Start Download
              </button>
            </div>
          )}

          {sharingStatus === 'transferring' && (
            <div className="space-y-2">
              <p className="text-center text-blue-400 mb-3">Downloading files...</p>
              {Object.entries(downloadProgress).map(([fileName, progress]) => (
                <div key={fileName} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-white">{fileName}</span>
                    <span className="text-gray-400">{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {sharingStatus === 'complete' && (
            <div className="text-center text-green-400">
              <Check className="h-12 w-12 mx-auto mb-2" />
              <p>Download complete!</p>
              {pendingFiles.length > 1 && (
                <p className="text-sm text-gray-400 mt-1">Files saved as: files_{inputCode}.zip</p>
              )}
            </div>
          )}

          {sharingStatus === 'error' && (
            <div className="text-center text-red-400">
              <X className="h-12 w-12 mx-auto mb-2" />
              <p>Transfer failed. Please try again.</p>
            </div>
          )}

          <button
            onClick={cancelTransfer}
            className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            {sharingStatus === 'complete' ? 'Done' : 'Cancel'}
          </button>
        </div>
      )}
    </div>
  )
}