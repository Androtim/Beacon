# Beacon V2 - Project Design & Architecture

## Core Vision
A premium, high-performance P2P file sharing and synchronized media platform. Focus on privacy, reliability, and "wow" factor aesthetics.

## The Team
- **Androbot (Lead):** Project coordination and logic integration.
- **Lumina (Frontend):** High-end UI/UX, animations, and "Premium" feel.
- **Flux (Protocol):** WebRTC stabilization, P2P signaling, and sync logic.
- **Sentinel (Security):** Hardening, auth verification, and P2P safety.

## Technical Priorities

### 1. P2P Reliability (Flux)
- Improve STUN/TURN configuration.
- Implement robust reconnection logic for WebRTC data channels.
- Optimize chunking for massive files (beyond 3GB).
- Fix Chrome-to-Firefox connection issues.

### 2. Synchronized Watch Rooms (Flux + Lumina)
- Replace broken iframe sync with a custom state-sync protocol.
- Support for: Local files (P2P streamed), direct URLs, and YouTube (via API wrapper).
- "Perfect Sync" mechanism: Latency compensation for video playback.

### 3. Premium UI/UX (Lumina)
- Dark-mode first design.
- Glassmorphism and micro-animations.
- Intuitive file transfer progress and "Room" management.

### 4. Security & Privacy (Sentinel)
- End-to-end encryption for metadata.
- Secure room codes and access controls.
- Hardened authentication flow.

## Roadmap
1. **Phase 1: Foundation (Current)**
   - Signaling server audit.
   - Design system definition.
   - Base networking fixes.
2. **Phase 2: Core Features**
   - High-performance P2P transfer engine.
   - Media sync engine.
3. **Phase 3: Polish**
   - UI/UX implementation.
   - Security hardening.
   - Cross-browser testing.
