# Beacon V2 Signaling Server Integration Plan

## 1. Architecture Overview

The new architecture splits responsibilities:
- **Node.js API (Existing)**: Handles User Authentication, Database (Users, Room persistence), and Business Logic.
- **Go Signaling Server (New)**: Handles high-concurrency WebSocket connections and real-time P2P signaling routing.

## 2. Authentication Flow

1.  **Login**: Client logs in via existing Node.js API (`POST /api/login`) and receives a JWT.
2.  **Connect**: Client establishes WebSocket connection to Go server:
    `ws://signaling.beacon.com/ws?token=<JWT>`
3.  **Validation**:
    -   Go server parses the JWT.
    -   **Option A (Fastest)**: Go server shares the JWT secret with Node.js and validates signature locally.
    -   **Option B (Decoupled)**: Go server calls `GET /api/verify?token=<JWT>` on Node.js API.
    -   *Recommendation*: Option A for performance.

## 3. Room Management

1.  **Create Room**: Client calls `POST /api/rooms` on Node.js API. Node.js creates room in DB and returns `roomId`.
2.  **Join Room**: Client sends `join` message over WebSocket to Go server with `roomId`.
    ```json
    {
      "type": "join",
      "payload": {
        "roomId": "12345",
        "userId": "user-uuid",
        "metadata": { "name": "Alice" }
      }
    }
    ```
3.  **Validation**: Go server checks if room exists in memory. If not, it creates it (dynamic) or validates against DB (strict).
    -   *Recommendation*: Dynamic creation for P2P mesh, strict if access control is needed.

## 4. Frontend Integration (React)

Replace `socket.io-client` with a custom `SignalingClient` adapter.

### Steps:
1.  Remove `socket.io-client` dependency.
2.  Add `SignalingClient` (see `client-adapter.ts`).
3.  Update React components to use `SignalingClient` instead of `socket`.

## 5. Deployment & Scaling

-   **Deployment**: Deploy Go binary (`signaling-server`) alongside Node.js containers. Expose via Nginx/Load Balancer.
-   **Scaling (Future)**:
    -   If a single Go instance hits limits (unlikely for < 50k concurrent), implement **Redis Pub/Sub**.
    -   When a message targets a user not on the local instance, publish to Redis channel `room:<roomId>`.
    -   Other instances subscribed to `room:<roomId>` receive and forward to the local client.

## 6. Migration Checklist

- [x] Deploy Go Signaling Server
- [ ] Update Nginx to route `/ws` to Go server port (8080)
- [ ] Share JWT Secret with Go server (env var `JWT_SECRET`)
- [ ] Update Frontend `SignalingClient`
- [ ] Test P2P Handshake (Offer/Answer/Candidate)
