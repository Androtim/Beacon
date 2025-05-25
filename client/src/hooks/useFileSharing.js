import { useState, useRef, useEffect, useCallback } from 'react'
import SimplePeer from 'simple-peer'

export default function useFileSharing(socket) {
  const [sharedFiles, setSharedFiles] = useState([])
  const [activeTransfers, setActiveTransfers] = useState([])
  const [shareCode, setShareCode] = useState('')
  const peersRef = useRef({})
  const fileSharesRef = useRef({})

  useEffect(() => {
    if (!socket) return

    const handleSignal = ({ from, signal }) => {
      if (peersRef.current[from]) {
        peersRef.current[from].signal(signal)
      }
    }

    const handleFileRequest = ({ from, fileInfo }) => {
      const shareData = Object.values(fileSharesRef.current).find(share => 
        share.files.some(f => f.id === fileInfo.id)
      )
      
      if (!shareData) return

      const file = shareData.files.find(f => f.id === fileInfo.id)
      if (!file) return

      const peer = new SimplePeer({ initiator: false })
      peersRef.current[from] = peer

      peer.on('signal', signal => {
        socket.emit('file-share-signal', { to: from, signal })
      })

      peer.on('connect', () => {
        sendFile(peer, file.file)
      })

      peer.on('error', err => {
        console.error('Peer error:', err)
        delete peersRef.current[from]
      })

      socket.emit('file-share-ready', { to: from, fileInfo })
    }

    const handleFileInfo = ({ files, hostId, code }) => {
      files.forEach(fileInfo => {
        setActiveTransfers(prev => [...prev, { 
          ...fileInfo, 
          progress: 0, 
          direction: 'download',
          code 
        }])
        socket.emit('file-share-request', { to: hostId, fileInfo })
      })
    }

    socket.on('file-share-signal', handleSignal)
    socket.on('file-share-request', handleFileRequest)
    socket.on('file-share-info', handleFileInfo)

    return () => {
      socket.off('file-share-signal', handleSignal)
      socket.off('file-share-request', handleFileRequest)
      socket.off('file-share-info', handleFileInfo)
      Object.values(peersRef.current).forEach(peer => peer.destroy())
    }
  }, [socket])

  const sendFile = (peer, file) => {
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
    reader.readAsArrayBuffer(file)
  }

  const receiveFile = useCallback((from, fileInfo) => {
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
        
        const progress = Math.round((chunks.filter(Boolean).length / message.total) * 100)
        setActiveTransfers(prev => prev.map(t => 
          t.id === fileInfo.id ? { ...t, progress } : t
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
  }, [socket])

  const shareFiles = useCallback((files) => {
    const code = Math.random().toString(36).substr(2, 6).toUpperCase()
    const fileData = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size,
      type: file.type
    }))
    
    fileSharesRef.current[code] = { files: fileData }
    setSharedFiles(prev => [...prev, ...fileData])
    setShareCode(code)
    
    socket.emit('file-share-create', {
      code,
      files: fileData.map(f => ({
        id: f.id,
        name: f.name,
        size: f.size,
        type: f.type
      }))
    })
    
    return code
  }, [socket])

  const joinFileShare = useCallback((code) => {
    if (!code.trim()) return
    
    socket.emit('file-share-join', { code: code.trim().toUpperCase() })
    
    socket.on('file-share-ready', ({ from, fileInfo }) => {
      receiveFile(from, fileInfo)
    })
  }, [socket, receiveFile])

  const cancelTransfer = useCallback((transferId) => {
    const peer = Object.values(peersRef.current).find(p => p.transferId === transferId)
    if (peer) {
      peer.destroy()
    }
    setActiveTransfers(prev => prev.filter(t => t.id !== transferId))
  }, [])

  return {
    sharedFiles,
    activeTransfers,
    shareCode,
    shareFiles,
    joinFileShare,
    cancelTransfer
  }
}