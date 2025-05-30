# Beacon - Cross-Platform Sync & Share Application

## Project Overview
Beacon is a React + Node.js web application for synchronized video watching and P2P file sharing. It allows users to watch videos in perfect sync with friends and share files directly between devices using WebRTC.

## Tech Stack

### Frontend (`/client/`)
- **React 18** with Vite for fast development
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Socket.io-client** for real-time communication
- **Simple Peer** for WebRTC P2P connections
- **Video.js** for media playback
- **Axios** for HTTP requests
- **Lucide React** for icons

### Backend (`/server/`)
- **Node.js** with Express
- **Socket.io** for real-time features
- **MongoDB** with Mongoose (with in-memory fallback)
- **JWT** authentication with bcryptjs
- **CORS** enabled for frontend communication
- **Multer** for file uploads
- **dotenv** for environment configuration

## Database Setup
- **Primary**: MongoDB (local or cloud via MONGODB_URI)
- **Fallback**: In-memory database for development
- **Connection**: Automatic fallback with 5-second timeout
- **Database name**: `beacon`

## Project Structure
```
/home/aider/Beacon/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.jsx        # Main app with routing
│   │   ├── components/    # Reusable components
│   │   ├── context/       # React contexts (AuthContext)
│   │   ├── hooks/         # Custom hooks
│   │   ├── pages/         # Page components
│   │   │   ├── Home.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Signup.jsx
│   │   │   ├── Settings.jsx
│   │   │   └── WatchParty.jsx
│   │   └── utils/         # Utility functions
│   ├── package.json
│   └── vite.config.js
├── server/                # Node.js backend
│   ├── index.js          # Main server file
│   ├── models/           # Mongoose models
│   │   └── User.js       # User schema with auth
│   ├── routes/           # API routes
│   │   └── auth.js       # Authentication routes
│   ├── middleware/       # Express middleware
│   │   └── auth.js       # JWT middleware
│   ├── utils/            # Server utilities
│   │   └── inMemoryDb.js # In-memory database fallback
│   ├── .env              # Environment variables
│   └── package.json
├── package.json          # Root package with scripts
└── README.md
```

## Development Commands

### Setup
```bash
npm run install-all    # Install all dependencies (root, client, server)
```

### Development
```bash
npm run dev            # Start both frontend and backend concurrently
npm run client         # Start only frontend (localhost:3000)
npm run server         # Start only backend (localhost:3001)
```

### Production
```bash
npm run build          # Build frontend for production
npm start              # Start production server
```

## Environment Configuration

### Server Environment (`.env`)
```
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
MONGODB_URI=mongodb://localhost:27017/beacon
```

## Key Features Implemented
1. **User Authentication**: JWT-based auth with bcrypt password hashing
2. **Real-time Communication**: Socket.io setup for live features
3. **Database Flexibility**: MongoDB with in-memory fallback
4. **Protected Routes**: Frontend route protection with AuthContext
5. **CORS Setup**: Proper CORS configuration for dev environment
6. **Video Synchronization**: Real-time synchronized video playback using Video.js
7. **Watch Party Rooms**: Room-based system for group video watching
8. **Live Chat**: Real-time messaging within watch parties
9. **Host Controls**: Host can set video URL and control playback for all participants
10. **Participant Management**: Real-time participant list with join/leave notifications
11. **P2P Video File Sharing**: Direct browser-to-browser video file transfer using WebRTC
12. **Multi-Source Video Support**: URL-based videos (YouTube, direct links) and local file sharing

## Frontend Components

### VideoPlayer (`client/src/components/VideoPlayer.jsx`)
- **Purpose**: Enhanced video player supporting multiple sources and formats
- **Features**: 
  - Direct video files (.mp4, .webm, .mov, .avi) with Video.js
  - YouTube video embedding with iframe
  - Local/blob video support for P2P sharing
  - Error handling and format validation
  - Responsive design with playback controls
- **Events**: onPlay, onPause, onSeeked, onTimeUpdate for synchronization
- **Props**: src (video URL or blob), callback functions, playerRef

### ChatBox (`client/src/components/ChatBox.jsx`)
- **Purpose**: Real-time chat interface for watch parties
- **Features**: Message history, auto-scroll, timestamps, system messages
- **Events**: Message sending, display formatting
- **Props**: messages array, onSendMessage callback

### VideoFileSharing (`client/src/components/VideoFileSharing.jsx`)
- **Purpose**: P2P video file sharing using WebRTC
- **Features**: 
  - Local video file upload (max 500MB)
  - Direct browser-to-browser file transfer
  - Real-time transfer progress tracking
  - Automatic video URL generation for playback
  - Host/participant role management
- **Technology**: SimplePeer for WebRTC P2P connections
- **Props**: socket, roomId, isHost, participants, onVideoReady callback

## Frontend Hooks

### useSocket (`client/src/hooks/useSocket.js`)
- **Purpose**: Socket.io connection management
- **Returns**: Socket instance with connection handling
- **Features**: Auto-connect/disconnect, connection status

### useWatchParty (`client/src/hooks/useWatchParty.js`)
- **Purpose**: Complete watch party state and functionality
- **Returns**: participants, isHost, messages, videoState, control functions
- **Features**: Room management, video sync, chat, participant tracking
- **Functions**: playVideo, pauseVideo, seekVideo, sendMessage

## Database Models

### User Model (`server/models/User.js`)
```javascript
{
  username: String (required, unique, 3-20 chars)
  email: String (required, unique, lowercase)
  password: String (required, hashed, min 6 chars)
  isOnline: Boolean (default: false)
  lastSeen: Date (default: now)
  createdAt: Date (auto)
  updatedAt: Date (auto)
}
```

## Authentication Flow
1. User registers/logs in via `/api/auth` routes
2. Server returns JWT token
3. Frontend stores token and user data in AuthContext
4. Protected routes check authentication status
5. JWT middleware validates tokens on protected API endpoints

## Development Notes
- Server automatically falls back to in-memory DB if MongoDB unavailable
- Frontend development server proxies API calls to backend
- Hot reload enabled for both frontend (Vite) and backend (--watch)
- CORS configured for localhost:3000 ↔ localhost:3001 communication

## MongoDB Setup Required
The project expects MongoDB to be running locally on default port 27017, or configured via MONGODB_URI environment variable. Without MongoDB, the server will use an in-memory database fallback.

## Socket.io Events

### Room Management
- **join-room**: User joins a watch party room
- **leave-room**: User leaves a watch party room
- **room-joined**: Sent to user when successfully joined (participants, host status, video state)
- **user-joined**: Broadcast when new user joins room
- **user-left**: Broadcast when user leaves room

### Video Synchronization
- **video-url-set**: Broadcast video URL change to all participants
- **video-play**: Broadcast play command with current time
- **video-pause**: Broadcast pause command with current time
- **video-seek**: Broadcast seek command with new time position

### P2P Video File Sharing
- **video-file-share**: Host broadcasts video file info to participants
- **video-file-info**: Participants receive file info and host ID
- **video-file-request**: Participant requests file from host
- **video-file-ready**: Host confirms ready to send file
- **video-file-signal**: WebRTC signaling for P2P connection

### Chat System
- **chat-message**: Send/receive chat messages in real-time
- System messages for user join/leave notifications

### Connection Management
- **connection**: Socket connection established
- **disconnect**: Automatic cleanup of user from all rooms

## Watch Party Usage

### Creating a Watch Party
1. Navigate to `/watch-party/{room-id}` (any unique room ID)
2. First user to join becomes the host (indicated by crown icon)
3. Host can set video URL using "Set Video URL" button
4. Share the room ID with friends to invite them

### Watch Party Features
- **Synchronized Playback**: All participants see the same video at the same time
- **Host Controls**: Only host can initially set video URL and control playback
- **Real-time Chat**: Text messaging between all participants
- **Participant List**: See who's currently in the room
- **Connection Status**: Visual indicator of Socket.io connection
- **Automatic Sync**: Video automatically syncs when users join mid-playback

### Supported Video Formats
- **URL-based**: Direct MP4/WebM/MOV/AVI video URLs
- **YouTube**: Embedded YouTube videos (no sync support)
- **Local Files**: P2P shared video files (.mp4, .webm, .mov, .avi, max 500MB)
- **Streaming**: HLS streams and other Video.js supported formats

### P2P Video File Sharing
- Host selects local video file (up to 500MB)
- File is transferred directly between browsers using WebRTC
- No server storage required - completely peer-to-peer
- Real-time progress tracking during transfer
- Automatic video playback once all participants have the file
- Full synchronization support for shared files

## Testing
- No test frameworks currently configured
- Manual testing via browser and API endpoints
- Test watch party: Create room, invite multiple users, test video sync and chat

## Deployment Considerations
- Frontend builds to static files via Vite
- Backend serves as standalone Node.js application
- MongoDB connection string needed for production
- JWT secret should be changed for production
- CORS origins should be updated for production domains

## Recent Updates (Session: January 2025)

### Latest Session Updates

#### P2P Video Sharing Fixes
1. **Fixed Socket Room Joining**: Added missing `socket.join(roomId)` in server
2. **Fixed Multiple Socket Instances**: Resolved issue where VideoFileSharing was using wrong socket
3. **Fixed Video Playback**: Implemented native HTML5 video for blob URLs
4. **Fixed Synchronization**: Added proper sync support for P2P videos
5. **File Size Limit**: Increased from 500MB to 3GB
6. **File Selection**: Can now replace/change files during session

#### General P2P File Transfer Feature
1. **8-Digit Share Codes**: Random alphanumeric codes for file sharing
2. **Multiple Files Support**: Up to 3GB total
3. **Zip Downloads**: Multiple files automatically zipped
4. **Progress Tracking**: Real-time upload/download progress
5. **Cancel Support**: Both sender and receiver can cancel
6. **Confirmation Dialog**: Recipients must accept before download

#### Private Messaging System
1. **Real-time DMs**: Direct messages between users
2. **Online Status**: Shows who's currently online/offline
3. **User Search**: Find users by username
4. **Message History**: Persists until page refresh
5. **Socket Authentication**: Auto-authenticates on connection

#### Dark/Light Mode Theme
1. **Theme Context**: Manages theme state with localStorage persistence
2. **Settings Toggle**: Theme switcher in Settings page
3. **All Pages Updated**: Consistent theming across entire app
4. **Tailwind Dark Mode**: Using class-based dark mode

## Recent Updates (Session: January 2025)

### Bug Fixes
1. **Fixed blank page issue**: Added global polyfill for simple-peer Node.js dependencies
2. **Fixed connection status**: Updated useSocket hook to track connection state reactively
3. **Fixed duplicate host issue**: Ensured consistent user ID format between MongoDB and in-memory DB
4. **Fixed participant list**: Corrected user-left event handling to include user details
5. **Fixed YouTube video handling**: Replaced blank page error with proper iframe embedding

### New Features
1. **Custom Watch Party Codes**: Users can now set custom party codes when creating rooms
2. **Copy Party Code Button**: Added copy-to-clipboard functionality in watch party header
3. **Enter Key Support**: Join party form now submits on Enter key press
4. **Leave Party Button**: Added button to leave watch party and return to home page
5. **YouTube Synchronization**: Attempted implementation (not possible due to iframe restrictions)
6. **P2P Video File Sharing**: Attempted implementation (debugging in progress)

### Technical Improvements
- Added Vite configuration for Node.js polyfills (global, process, buffer)
- Installed vite-plugin-node-polyfills to handle Node.js module externalization
- Created YouTubePlayer component (removed due to sync limitations)
- Updated VideoPlayer to show clear warning about YouTube sync limitations
- Fixed VideoFileSharing component structure with proper useCallback hooks
- Enhanced error handling and debugging throughout the application
- Added extensive console logging for P2P debugging

### P2P Video Sharing Implementation Status
- **Architecture**: Complete - uses SimplePeer for WebRTC connections
- **UI**: Complete - host can select files, participants see download progress
- **Socket Events**: Implemented but experiencing issues:
  - `video-file-share`: Host broadcasts file info
  - `video-file-info`: Participants receive file metadata
  - `video-file-request`: Participant requests file from host
  - `video-file-ready`: Host confirms ready to send
  - `video-file-signal`: WebRTC signaling
- **Current Issues**:
  - Socket events not reaching participants despite being in same room
  - VideoFileSharing component now visible to all users (not just when host selects P2P mode)
  - Added debug button to test socket connections
  - Socket connections confirmed working, but custom events not propagating

### Recent Debugging Steps
1. Fixed component to show for all users (not just in P2P mode)
2. Added extensive console logging to track event flow
3. Added test button to verify socket connections
4. Enhanced server logging to show room membership
5. Confirmed sockets are connected and in correct rooms
6. Issue appears to be with event listener setup or event propagation
7. **Fixed missing socket.join(roomId)** in server join-room handler
8. **Fixed duplicate socket instances**: 
   - WatchParty.jsx was creating its own socket instance
   - useWatchParty hook was creating another socket instance (only this one joined the room)
   - VideoFileSharing was using the wrong socket (the one from WatchParty)
   - Solution: Modified useWatchParty to return its socket instance
   - Updated WatchParty to use the socket from useWatchParty instead of creating a new one

### Latest Session (May 26, 2025) - Major Bug Fixes & Feature Improvements

#### WSL Networking Issues Resolved
1. **Fixed WSL Network Binding**:
   - Updated Vite config to bind to `0.0.0.0` for WSL compatibility
   - Updated server to listen on all interfaces (`0.0.0.0`)
   - Fixed CORS configuration to accept WSL IP addresses
   - Resolved pending request issues in WSL environment

2. **Authentication & Connection Fixes**:
   - Fixed axios timeout issues that prevented login
   - Resolved infinite loading states in AuthContext
   - Added proper error handling and timeouts
   - Fixed token validation and storage

3. **Copy Button Functionality Fixed**:
   - Added fallback method using `document.execCommand` for clipboard API failures
   - Shows alert with code if all copy methods fail
   - Works across all browsers including those with strict permissions

4. **P2P Video File Sharing Improvements**:
   - Fixed socket room joining issues for video file sharing in watch parties
   - Enhanced debugging with detailed console logs
   - Fixed user authentication to handle both `_id` and `id` properties
   - Added comprehensive WebRTC configuration

5. **File Transfer System Enhancements**:
   - Fixed video/audio file transfers that were failing
   - Improved binary data handling for media files
   - Reduced chunk size from 64KB to 16KB for better reliability
   - Added retry logic for failed chunks
   - Enhanced flow control with better buffer management

6. **Cross-Browser Compatibility Fixed**:
   - Added comprehensive WebRTC configuration for Chrome-Firefox compatibility
   - Set `trickle: false` for better cross-browser support
   - Added multiple STUN servers (stun.l.google.com:19302-19306)
   - Added channel configuration for ordered, reliable delivery
   - Fixed WebRTC data channel options for compatibility

7. **Messaging System Improvements**:
   - Fixed username display bug in search results
   - Ensured consistent user object format across API responses
   - Fixed socket authentication to include all user data
   - Standardized user ID handling between MongoDB and in-memory DB

8. **Persistent Message History Implemented**:
   - Created Message model for MongoDB storage
   - Added message storage support in in-memory database
   - Added API endpoints:
     - `GET /api/messages/:userId` - Get message history with a user
     - `GET /api/conversations` - Get all conversations with last message
   - Messages now persist across page refreshes
   - Message history loads when selecting a user
   - Messages are properly saved to database
   - **Issue**: Conversation list doesn't persist in UI when navigating away

#### Completed Features
1. **Messages System Redesign**:
   - Changed from showing all online users to search-based system
   - Added `/api/users/search` endpoint with JWT authentication
   - Search by username with debounced queries
   - Separate sections for search results and active conversations
   - Added back navigation button to return to home page

2. **File Transfer System Enhanced**:
   - General P2P file transfer (outside watch parties) with 8-digit codes
   - Increased file size limit from 500MB to 3GB
   - Multiple file downloads packaged as ZIP files
   - Added enter key support for connection form
   - Fixed file selection to allow changing files
   - "Cancel" button changes to "Done" when transfer complete

3. **Theme System**:
   - Added dark/light mode toggle with ThemeContext
   - Added theme switcher in Settings page
   - Fixed Tailwind CSS configuration (added missing primary-400 color)
   - Consistent theming across all components

4. **Navigation & UI Fixes**:
   - Fixed party creation to use React Router navigate instead of window.location
   - Moved navigation tabs to header bar as requested
   - Added proper loading states and error handling

#### Previously Fixed Issues ✅

**Socket Connection Issues (FIXED)**:
- ✅ Socket.io client can now connect reliably
- ✅ Watch parties should show proper connection status
- ✅ File sharing connection issues resolved
- ✅ Username search works with proper JWT authentication

**Solutions Implemented**:
1. ✅ Replaced `node --watch` with `nodemon` for stable process management
2. ✅ Created port cleanup utility to prevent EADDRINUSE errors
3. ✅ Enhanced CORS configuration for Socket.IO
4. ✅ Fixed axios base URL configuration in AuthContext
5. ✅ Added proper credentials support for cross-origin requests

**Development Setup Improvements**:
- Use `npm run dev:clean` for clean server starts
- Use `npm run kill-port` to manually clean up port 3001
- Server now handles port conflicts gracefully with clear error messages

#### Current Status (After Bug Fixes - May 26, 2025)

**✅ Fixed & Working Features**:
- User authentication & registration with JWT
- WSL networking compatibility (servers bind to all interfaces)
- CORS configuration for WSL IP addresses
- Health check endpoint at `/api/health`
- Process management with nodemon and cleanup scripts
- Dark/light theme switching
- Navigation and routing
- Copy-to-clipboard functionality with fallbacks
- Message persistence in database (messages saved across sessions)
- Private messaging between users
- User search functionality

**🔧 Partially Working**:
- **File Sharing from Chrome**: Still experiencing issues when sharing from Chrome browser
- **Video Sharing in Watch Party from Chrome**: P2P video sharing not working reliably from Chrome
- **Messages UI State**: Conversations disappear from UI when navigating away and back (messages are saved in DB but UI doesn't persist conversation list)

**⚠️ Known Issues & Limitations**:
- **Chrome WebRTC Issues**: File sharing and video sharing in watch parties don't work from Chrome (likely needs additional WebRTC configuration)
- **Conversation List Persistence**: Need to re-search users when returning to Messages page (conversations should load automatically from API)
- YouTube videos CANNOT be synchronized (iframe security restrictions)
- P2P file sharing limited to 3GB
- WebRTC requires good network connectivity
- WSL networking requires accessing app via IP (172.18.191.100:3000)

**🚧 Next Steps**:
- Fix Chrome WebRTC compatibility for file/video sharing
- Implement conversation list persistence in Messages UI
- Add proper error handling for WebRTC failures
- Improve WebRTC connection diagnostics
- Add retry mechanisms for failed P2P connections

### Latest Session (May 26, 2025 - Continued) - Bug Fixes

#### Fixed Issues
1. **Chrome WebRTC Data Channel Error** ✅:
   - Fixed "RTCDataChannel cannot have both max retransmits and max lifetime" error
   - Removed conflicting `maxPacketLifeTime` and `negotiated`/`id` options from channel config
   - Chrome now properly creates data channels for P2P connections

2. **Conversations API Error** ✅:
   - Fixed MongoDB ObjectId constructor error in conversations endpoint
   - Added `new` keyword to all `mongoose.Types.ObjectId()` calls
   - Conversations API now returns data properly

3. **Conversation List Persistence** ✅:
   - Fixed MongoDB aggregation pipeline in conversations endpoint
   - Fixed ObjectId comparison and user lookup issues
   - Added proper projection to ensure user data includes both `id` and `_id` fields
   - Conversations now persist properly when navigating away and returning to Messages
   - Messages are saved to database correctly and conversations load on refresh

4. **Chrome to Firefox WebRTC** (in progress):
   - Enabled trickle ICE for Chrome browsers (Firefox still uses non-trickle)
   - Added ICE candidate error logging for Chrome
   - Added detailed ICE candidate type logging
   
   - **Chrome WebRTC Improvements**:
     - Added comprehensive ICE server configuration including public TURN servers
     - Added Chrome-specific WebRTC configuration options
     - Added connection state monitoring for better debugging
     - Reduced buffer threshold from 65KB to 16KB for Chrome compatibility
     - Added Chrome browser detection for targeted fixes

### Known Limitations & Remaining Issues

**🔴 Remaining Issues**:
- **Chrome to Firefox WebRTC**: File sharing and video sharing from Chrome to Firefox still failing
  - Firefox to Chrome works perfectly ✅
  - Chrome to Chrome needs testing
  - Added TURN servers and Chrome-specific configuration
  - May need additional SDP manipulation or different TURN server configuration
  - Check browser console for detailed ICE connection state logs

**⚠️ Technical Limitations**:
- **YouTube videos CANNOT be synchronized** due to iframe security restrictions
- P2P file sharing limited to 3GB to prevent browser memory issues
- WebRTC requires good network connectivity for reliable transfers
- WSL requires using IP address instead of localhost

**📝 Notes for Next Session**:
1. **Chrome to Firefox WebRTC Issue**:
   - Firefox to Chrome works perfectly ✅
   - Chrome to Firefox still fails during ICE negotiation
   - Check ICE connection state logs in browser console
   - May need to implement SDP munging for Chrome
   - Consider using different TURN server providers
   - Test with chrome://webrtc-internals for detailed diagnostics
   - Test Chrome to Chrome transfers with new configuration
   
2. **Current Working State**:
   - All major features working properly
   - Message persistence fully functional
   - Database operations stable
   - WebRTC works in most browser combinations
   - Only remaining issue is Chrome→Firefox WebRTC transfers