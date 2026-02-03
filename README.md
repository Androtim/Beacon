# Beacon V2 - Synchronized P2P Experience 📡

Beacon is a high-performance, decentralized web platform designed for synchronized media viewing and secure peer-to-peer file sharing. By leveraging WebRTC and Socket.io, Beacon eliminates the need for middleman servers, ensuring your data moves directly between devices with zero latency and maximum privacy.

![Status](https://img.shields.io/badge/Status-V2_Beta-violet)
![Encryption](https://img.shields.io/badge/Security-P2P_Encrypted-cyan)
![Interface](https://img.shields.io/badge/UI-Mobile_Optimized-green)

## ✨ Core Protocols

### 🎬 Perfect-Sync Watch Parties
*   **Latecomer Synchronization**: New participants joining an active session automatically receive the current media state and file metadata, jumping into perfect sync with the group instantly.
*   **Multi-Source Engine**: Support for direct video links (.mp4, .webm), HLS streams, and local P2P shared files.
*   **Host Privileges**: Room creators maintain master control over playback, seeking, and source coordinates.
*   **Real-time Comms**: Integrated encrypted chat for coordinated viewing.

### 📁 Direct-Link File Sharing
*   **Pure P2P Transfer**: Files are streamed directly from browser-to-browser. No server storage, no limits (up to 3GB per object).
*   **8-Digit Intercept Codes**: Simple alphanumeric coordinates for secure, one-to-one transfers.
*   **Progressive Synchronization**: Real-time telemetry for upload and download states across all peers.

### 📱 Mobile-First Architecture
*   **Responsive Scaling**: Overhauled UI using `dvh` units to handle mobile browser address bars and notched displays.
*   **Glassmorphism Design**: A premium, dark-mode aesthetic built for modern high-refresh-rate screens.

## 🛠 Tech Stack

*   **Frontend**: React 18, Vite, Framer Motion, Tailwind CSS, Lucide Icons.
*   **Networking**: WebRTC (Simple-Peer), Socket.io-client.
*   **Backend**: Node.js, Express, Socket.io, JWT Authentication.
*   **Database**: MongoDB (Production) with In-Memory fallback (Development).

## 🚀 Deployment Coordinates

### Prerequisites
*   **Node.js**: v18 or higher
*   **Public Access**: For remote testing (e.g., on a phone), use a tunnel like Cloudflare or Localtunnel.

### Quick Start
1.  **Clone the Protocol:**
    ```bash
    git clone https://github.com/Androtim/Beacon.git
    cd Beacon
    ```
2.  **Initialize Environment:**
    ```bash
    # Set up server environment
    cd server
    echo "JWT_SECRET=your_secure_secret" > .env
    ```
3.  **Launch Ecosystem:**
    ```bash
    # From the root directory
    npm run install-all
    npm run dev
    ```

## 📋 API Overview

*   `POST /api/auth/register` - Initialize new operator
*   `POST /api/auth/login` - Authenticate session
*   `GET /api/ice-servers` - Fetch WebRTC traversal coordinates (STUN/TURN)
*   `GET /api/messages/:userId` - Retrieve encrypted comms history

---

**Protocol Note**: This project is under active development by the Beacon V2 team. Recent updates focused on P2P handshake reliability and mobile UI clipping fixes. 🦞
