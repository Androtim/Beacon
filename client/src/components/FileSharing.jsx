import { useState, useRef, useEffect } from 'react'
import { Upload, Download, File, X, Copy, Check } from 'lucide-react'
import SimplePeer from 'simple-peer'

export default function FileSharing({ socket, roomId }) {
  const [files, setFiles] = useState([])
  const [activeTransfers, setActiveTransfers] = useState([])
  const [shareCode, setShareCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef(null)
  const peersRef = useRef({})

  useEffect(() => {
    if (!socket) return

    socket.on('file-share-signal', handleSignal)
    socket.on('file-share-request', handleFileRequest)
    socket.on('file-share-ready', handleFileReady)

    return () => {
      socket.off('file-share-signal')
      socket.off('file-share-request')
      socket.off('file-share-ready')
      Object.values(peersRef.current).forEach(peer => peer.destroy())
    }
  }, [socket])

  const handleSignal = ({ from, signal }) => {
    if (peersRef.current[from]) {
      peersRef.current[from].signal(signal)
    }
  }

  const handleFileRequest = ({ from, fileInfo }) => {
    const file = files.find(f => f.id === fileInfo.id)
    if (!file) return

    const peer = new SimplePeer({ initiator: false })
    peersRef.current[from] = peer

    peer.on('signal', signal => {
      socket.emit('file-share-signal', { to: from, signal })
    })

    peer.on('connect', () => {
      const reader = new FileReader()
      reader.onload = () => {
        const chunks = []
        const chunkSize = 16384
        const buffer = reader.result
        
        for (let i = 0; i < buffer.byteLength; i += chunkSize) {
          chunks.push(buffer.slice(i, i + chunkSize))
        }

        chunks.forEach((chunk, index) => {
          peer.send(JSON.stringify({
            type: 'chunk',
            data: Array.from(new Uint8Array(chunk)),
            index,
            total: chunks.length
          }))
        })

        peer.send(JSON.stringify({ type: 'complete' }))
      }
      reader.readAsArrayBuffer(file.file)
    })

    peer.on('error', err => {
      console.error('Peer error:', err)
      delete peersRef.current[from]
    })
  }

  const handleFileReady = ({ from, fileInfo }) => {
    const peer = new SimplePeer({ initiator: true })
    peersRef.current[from] = peer
    const chunks = []

    peer.on('signal', signal => {
      socket.emit('file-share-signal', { to: from, signal })
    })

    peer.on('data', data => {
      const message = JSON.parse(data.toString())
      
      if (message.type === 'chunk') {
        chunks[message.index] = new Uint8Array(message.data)
        
        setActiveTransfers(prev => prev.map(t => 
          t.id === fileInfo.id 
            ? { ...t, progress: Math.round((chunks.filter(Boolean).length / message.total) * 100) }
            : t
        ))
      } else if (message.type === 'complete') {
        const blob = new Blob(chunks)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileInfo.name
        a.click()
        URL.revokeObjectURL(url)
        
        setActiveTransfers(prev => prev.filter(t => t.id !== fileInfo.id))
        delete peersRef.current[from]
      }
    })

    peer.on('error', err => {
      console.error('Peer error:', err)
      setActiveTransfers(prev => prev.filter(t => t.id !== fileInfo.id))
      delete peersRef.current[from]
    })
  }

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files)
    const newFiles = selectedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size,
      type: file.type
    }))
    
    setFiles(prev => [...prev, ...newFiles])
    generateShareCode(newFiles)
  }

  const generateShareCode = (filesToShare) => {
    const code = Math.random().toString(36).substr(2, 6).toUpperCase()
    setShareCode(code)
    
    socket.emit('file-share-create', {
      code,
      files: filesToShare.map(f => ({
        id: f.id,
        name: f.name,
        size: f.size,
        type: f.type
      }))
    })
  }

  const joinFileShare = () => {
    if (!joinCode.trim()) return
    
    socket.emit('file-share-join', { code: joinCode.trim().toUpperCase() })
    socket.once('file-share-info', ({ files, hostId }) => {
      files.forEach(fileInfo => {
        setActiveTransfers(prev => [...prev, { ...fileInfo, progress: 0 }])
        socket.emit('file-share-request', { to: hostId, fileInfo })
      })
    })
    
    setJoinCode('')
  }

  const copyShareCode = () => {
    navigator.clipboard.writeText(shareCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">File Sharing</h3>
      
      <div className="space-y-4">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Select Files to Share
          </button>
        </div>

        {shareCode && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 mb-2">Share this code with others:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white px-3 py-2 rounded border border-blue-300 font-mono text-lg text-center">
                {shareCode}
              </code>
              <button
                onClick={copyShareCode}
                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
              >
                {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter share code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            className="flex-1 input-field"
          />
          <button
            onClick={joinFileShare}
            disabled={!joinCode.trim()}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Shared Files</h4>
            {files.map(file => (
              <div key={file.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <File className="h-5 w-5 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
                <button
                  onClick={() => setFiles(prev => prev.filter(f => f.id !== file.id))}
                  className="p-1 text-gray-400 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTransfers.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Active Transfers</h4>
            {activeTransfers.map(transfer => (
              <div key={transfer.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 truncate">{transfer.name}</span>
                  <span className="text-xs text-gray-500">{transfer.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${transfer.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}