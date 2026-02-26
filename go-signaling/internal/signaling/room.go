package signaling

import (
	"encoding/json"
	"log"
	"sync"
	"github.com/beacon/signaling/pkg/protocol"
)

type Room struct {
	ID      string
	// Map client ID to Client pointer for O(1) lookup
	Clients map[string]*Client
	mu      sync.RWMutex
}

func NewRoom(id string) *Room {
	return &Room{
		ID:      id,
		Clients: make(map[string]*Client),
	}
}

func (r *Room) AddClient(client *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Clients[client.ID] = client
}

func (r *Room) RemoveClient(client *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.Clients[client.ID]; ok {
		delete(r.Clients, client.ID)
		close(client.Send)
	}
}

func (r *Room) Broadcast(msg protocol.Message) {
	bytes, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Failed to marshal broadcast message: %v", err)
		return
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, client := range r.Clients {
		select {
		case client.Send <- bytes:
		default:
			// Channel full, drop message to avoid blocking
			log.Printf("Dropped message to client %s (channel full)", client.ID)
		}
	}
}

func (r *Room) BroadcastExcept(sender *Client, msg protocol.Message) {
	bytes, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Failed to marshal broadcast message: %v", err)
		return
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, client := range r.Clients {
		if client.ID == sender.ID {
			continue
		}
		select {
		case client.Send <- bytes:
		default:
			// Channel full, drop message to avoid blocking
			log.Printf("Dropped message to client %s (channel full)", client.ID)
		}
	}
}

func (r *Room) SendTo(targetID string, msg protocol.Message) {
	bytes, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Failed to marshal message: %v", err)
		return
	}

	r.mu.RLock()
	client, ok := r.Clients[targetID]
	r.mu.RUnlock()

	if !ok {
		// Only log debug/info if strict user tracking is enabled
		// otherwise this can be noisy for users who just left
		return
	}

	select {
	case client.Send <- bytes:
	default:
		// Channel full, drop message to avoid blocking
		log.Printf("Dropped message to client %s (channel full)", client.ID)
	}
}
