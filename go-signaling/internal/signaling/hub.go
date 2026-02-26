package signaling

import (
	"encoding/json"
	"log"
	"sync"
	"github.com/beacon/signaling/pkg/protocol"
)

type IncomingMessage struct {
	Client  *Client
	Payload []byte
}

type Hub struct {
	// Registered clients.
	clients map[*Client]bool

	// Rooms map for O(1) access
	rooms map[string]*Room

	// Inbound messages from the clients.
	broadcast chan []byte

	// Register requests from the clients.
	register chan *Client

	// Unregister requests from clients.
	unregister chan *Client

	// Incoming messages from clients
	incoming chan *IncomingMessage

	// Mutex for thread-safe access to clients and rooms map
	mu sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
		rooms:      make(map[string]*Room),
		incoming:   make(chan *IncomingMessage),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
				h.mu.Unlock() // Unlock before cleaning up room
				h.removeClientFromRoom(client)
			} else {
				h.mu.Unlock()
			}

		case msg := <-h.incoming:
			h.handleMessage(msg)
		}
	}
}

func (h *Hub) removeClientFromRoom(client *Client) {
	if client.RoomID == "" {
		return
	}
	
	h.mu.Lock()
	room, exists := h.rooms[client.RoomID]
	h.mu.Unlock()

	if !exists {
		return
	}

	room.RemoveClient(client)

	room.mu.RLock()
	empty := len(room.Clients) == 0
	room.mu.RUnlock()

	if empty {
		h.mu.Lock()
		delete(h.rooms, client.RoomID)
		h.mu.Unlock()
	} else {
		// Notify others in the room
		room.BroadcastExcept(client, protocol.Message{
			Type:   protocol.TypeLeave,
			Sender: client.ID,
		})
	}
	client.RoomID = ""
}

func (h *Hub) handleMessage(msg *IncomingMessage) {
	var m protocol.Message
	if err := json.Unmarshal(msg.Payload, &m); err != nil {
		log.Printf("Invalid JSON from client %s", msg.Client.ID)
		return
	}

	// Route based on message type
	switch m.Type {
	case protocol.TypeJoin:
		h.handleJoin(msg.Client, m.Payload)
	case protocol.TypeOffer, protocol.TypeAnswer, protocol.TypeICECandidate, protocol.TypeMetadata:
		h.handleSignaling(msg.Client, m)
	case protocol.TypeLeave:
		h.removeClientFromRoom(msg.Client)
	default:
		log.Printf("Unknown message type: %s", m.Type)
	}
}

func (h *Hub) handleJoin(client *Client, payload interface{}) {
	// Parse payload
	bytes, _ := json.Marshal(payload)
	var joinPayload protocol.JoinPayload
	if err := json.Unmarshal(bytes, &joinPayload); err != nil {
		log.Printf("Invalid join payload structure from client %s", client.ID)
		return
	}

	h.mu.Lock()
	room, exists := h.rooms[joinPayload.RoomID]
	if !exists {
		room = NewRoom(joinPayload.RoomID)
		h.rooms[joinPayload.RoomID] = room
	}
	h.mu.Unlock()

	client.RoomID = joinPayload.RoomID
	client.UserID = joinPayload.UserID
	client.Metadata = joinPayload.Metadata

	room.AddClient(client)

	// Send current room state to new client
	// Collect existing clients
	clientInfos := make([]protocol.ClientInfo, 0)
	room.mu.RLock()
	for _, c := range room.Clients {
		if c.ID != client.ID {
			clientInfos = append(clientInfos, protocol.ClientInfo{
				ID:       c.ID,
				UserID:   c.UserID,
				Metadata: c.Metadata,
			})
		}
	}
	room.mu.RUnlock()
	
	// Send room state
	client.SendJSON(protocol.Message{
		Type:    protocol.TypeMetadata,
		Payload: clientInfos,
	})

	// Notify others
	room.BroadcastExcept(client, protocol.Message{
		Type:   protocol.TypeJoin,
		Sender: client.ID,
		Payload: protocol.ClientInfo{
			ID:       client.ID,
			UserID:   client.UserID,
			Metadata: client.Metadata,
		},
	})
}

func (h *Hub) handleSignaling(sender *Client, msg protocol.Message) {
	if sender.RoomID == "" {
		return
	}

	h.mu.RLock()
	room, exists := h.rooms[sender.RoomID]
	h.mu.RUnlock()

	if !exists {
		return
	}

	// Set sender ID on message to be sure
	msg.Sender = sender.ID

	// If target is specified, send only to target
	if msg.Target != "" {
		room.SendTo(msg.Target, msg)
	} else {
		// Broadcast to all except sender
		room.BroadcastExcept(sender, msg)
	}
}
