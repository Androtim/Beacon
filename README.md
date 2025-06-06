# Beacon - Cross-Platform Sync & Share Application

A React + Node.js web application for synchronized video watching and peer-to-peer file sharing. Watch videos in perfect sync with friends and share files directly between devices using WebRTC.

![Status](https://img.shields.io/badge/Status-In%20Development-yellow)
![Node](https://img.shields.io/badge/Node.js-18+-green)
![React](https://img.shields.io/badge/React-18-blue)
![MongoDB](https://img.shields.io/badge/MongoDB-Optional-orange)

## ✨ Features

### 🎬 Watch Parties
- **Synchronized Video Playback**: Watch videos in perfect sync with friends
- **Multi-Source Support**: YouTube videos, direct video links, and local files
- **Real-time Chat**: Group messaging during watch parties
- **Host Controls**: Room creators control video playback for all participants
- **Participant Management**: See who's in the room with join/leave notifications

### 📁 File Sharing
- **P2P File Transfer**: Direct browser-to-browser file sharing (up to 3GB)
- **8-Digit Share Codes**: Easy sharing with random alphanumeric codes  
- **Multiple Files**: Send multiple files, automatically packaged as ZIP
- **Progress Tracking**: Real-time upload/download progress
- **No Server Storage**: Files transfer directly between browsers

### 💬 Private Messaging  
- **Real-time Direct Messages**: Private chat between users
- **User Search**: Find users by username
- **Online Status**: See who's currently online/offline
- **Message History**: Full conversation persistence across sessions

### 🎨 Customization
- **Dark/Light Theme**: Toggle between themes with persistent settings
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Custom Party Codes**: Create watch parties with custom room codes

## 🛠 Tech Stack

### Frontend (`/client/`)
- **React 18** with Vite for fast development
- **Tailwind CSS** for styling and dark mode
- **React Router** for navigation  
- **Socket.io-client** for real-time communication
- **Simple Peer** for WebRTC P2P connections
- **Video.js** for media playback
- **Axios** for HTTP requests
- **JSZip** for file packaging
- **Lucide React** for icons

### Backend (`/server/`)
- **Node.js** with Express
- **Socket.io** for real-time features
- **MongoDB** with Mongoose (with in-memory fallback)
- **JWT** authentication with bcryptjs
- **CORS** enabled for frontend communication
- **dotenv** for environment configuration

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 or higher)
- **MongoDB** (optional - falls back to in-memory database)
- **Modern web browser** with WebRTC support

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/YOUR_USERNAME/Beacon.git
cd Beacon
```

2. **Install all dependencies:**
```bash
npm run install-all
```

3. **Set up environment variables:**
```bash
# Create server .env file
cd server
cp .env.example .env  # If available, or create manually
```

**Server Environment (`.env`):**
```bash
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
MONGODB_URI=mongodb://localhost:27017/beacon
```

4. **Start MongoDB (optional):**
```bash
# If using local MongoDB
mongod

# Or use MongoDB Atlas cloud database
# Update MONGODB_URI in .env with your connection string
```

5. **Start the development servers:**
```bash
npm run dev
```

This will start:
- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:3001

## 📱 Usage

### Getting Started
1. **Sign Up/Login** - Create an account or sign in
2. **Choose Your Activity** - Watch parties, file transfer, or messaging

### Watch Parties  
1. **Create Party** - Generate a random or custom party code
2. **Share Code** - Send the code to friends to invite them
3. **Set Video** - Host selects video URL or uploads local file
4. **Enjoy Together** - Watch in sync with real-time chat

### File Sharing
1. **Select Files** - Choose files to share (up to 3GB total)
2. **Get Share Code** - 8-digit code is generated automatically  
3. **Share Code** - Send code to recipient
4. **Connect & Transfer** - Recipient enters code to start P2P transfer

### Private Messages
1. **Search Users** - Find users by username  
2. **Start Conversation** - Click on user to begin messaging
3. **Real-time Chat** - Send and receive messages instantly

## 🏗 Project Structure

```
/home/aider/Beacon/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.jsx        # Main app with routing
│   │   ├── components/    # Reusable components
│   │   │   ├── ChatBox.jsx
│   │   │   ├── VideoPlayer.jsx
│   │   │   ├── VideoFileSharing.jsx
│   │   │   └── FileShare.jsx
│   │   ├── context/       # React contexts
│   │   │   ├── AuthContext.jsx
│   │   │   └── ThemeContext.jsx
│   │   ├── hooks/         # Custom hooks
│   │   │   ├── useSocket.js
│   │   │   └── useWatchParty.js
│   │   ├── pages/         # Page components
│   │   │   ├── Home.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Signup.jsx
│   │   │   ├── Settings.jsx
│   │   │   ├── WatchParty.jsx
│   │   │   └── Messages.jsx
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
├── CLAUDE.md             # Development documentation
└── README.md
```

## 🎯 Development Commands

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

## ⚠️ Current Status & Known Issues

### ✅ Working Features
- User authentication & registration with JWT
- WSL networking compatibility (servers bind to all interfaces)
- CORS configuration for cross-platform access
- Dark/light theme switching
- Navigation and routing
- Watch party creation with real-time video synchronization
- P2P file sharing (up to 3GB) with progress tracking
- Private messaging with full conversation persistence across sessions
- Firefox to Chrome WebRTC transfers work perfectly
- Copy-to-clipboard functionality with fallbacks

### 🔧 Recently Fixed (May 26, 2025)
- **Chrome WebRTC Data Channel**: Fixed configuration conflict that prevented Chrome P2P connections
- **Conversation Persistence**: Fixed MongoDB aggregation pipeline - conversations now persist across page refreshes
- **Database Message Storage**: Messages properly saved to database and conversations load correctly
- **User Authentication**: Fixed socket authentication for reliable message sending
- **ObjectId Handling**: Fixed MongoDB ObjectId constructor issues in conversations API

### 🚨 Known Issues
- **Chrome to Firefox WebRTC**: File/video sharing from Chrome to Firefox still has connection issues (Firefox to Chrome works fine)
- **WSL Networking**: App must be accessed via WSL IP (e.g., 172.18.191.100:3000) when running in WSL
- **YouTube Sync Limitation**: YouTube videos cannot be synchronized due to iframe security restrictions

### 🚧 Development Notes
- Servers configured to bind to all interfaces for WSL compatibility
- CORS configured for both localhost and WSL IP addresses
- WebRTC uses multiple STUN servers for better connectivity
- File transfers use 16KB chunks for reliability
- Message history stored in database (MongoDB or in-memory)

## 🔧 Troubleshooting

### WSL Networking Issues
If running in WSL and can't access localhost:
```bash
# Access via WSL IP instead of localhost
http://172.18.191.100:3000/

# Check your WSL IP
hostname -I
```

### Port Conflicts
If you see `EADDRINUSE` errors:
```bash
# Kill processes using ports 3000/3001
fuser -k 3000/tcp 3001/tcp

# Or use the built-in cleanup
npm run kill-port
```

### MongoDB Connection
If MongoDB is unavailable, the app automatically falls back to an in-memory database for development.

### CORS Issues
If you see CORS errors, ensure you're accessing the app via the correct URL:
- WSL: `http://172.18.191.100:3000/`
- Local: `http://localhost:3000/`

## 📋 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user info (protected)

### Users (Protected)
- `GET /api/users/search?query=username` - Search users by username

### Messages (Protected)
- `GET /api/messages/:userId` - Get message history with specific user
- `GET /api/conversations` - Get all conversations with last message

### Health Check
- `GET /api/health` - Server status and database info

## 🎨 Supported Video Formats

### URL-based Videos
- Direct video links (.mp4, .webm, .mov, .avi)
- YouTube videos (embedded, but **no sync support**)
- HLS streams and other Video.js supported formats

### Local File Sharing
- P2P shared video files (.mp4, .webm, .mov, .avi)
- Maximum 3GB per transfer
- Direct browser-to-browser transfer (no server storage)

## 🚀 Deployment Considerations

- Frontend builds to static files via Vite
- Backend serves as standalone Node.js application  
- MongoDB connection string needed for production
- JWT secret should be changed for production
- CORS origins should be updated for production domains
- Consider using PM2 for production process management

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏷️ Version History

- **v1.0.0** (In Development) - Initial release with watch parties, file sharing, and messaging
- **Current Focus** - Fixing socket connection reliability for real-time features

---

**Note**: This project is actively under development. Some features may be unstable or incomplete. See `CLAUDE.md` for detailed development notes and current session status.