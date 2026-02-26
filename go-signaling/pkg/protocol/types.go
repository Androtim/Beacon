package protocol

// MessageType defines the type of signaling message
type MessageType string

const (
	TypeJoin         MessageType = "join"
	TypeLeave        MessageType = "leave"
	TypeOffer        MessageType = "offer"
	TypeAnswer       MessageType = "answer"
	TypeICECandidate MessageType = "ice-candidate"
	TypeMetadata     MessageType = "metadata" // e.g. user info update
	TypeError        MessageType = "error"
)

// Message represents the standard signaling message structure
type Message struct {
	Type    MessageType     `json:"type"`
	Payload interface{}     `json:"payload"`
	Target  string          `json:"target,omitempty"` // Target client ID (for P2P routing)
	Sender  string          `json:"sender,omitempty"` // Sender client ID (filled by server)
}

// JoinPayload is the payload for joining a room
type JoinPayload struct {
	RoomID   string                 `json:"roomId"`
	UserID   string                 `json:"userId"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// RoomInfo represents the current state of a room
type RoomInfo struct {
	RoomID  string                 `json:"roomId"`
	Clients []ClientInfo           `json:"clients"`
}

// ClientInfo represents public info about a connected client
type ClientInfo struct {
	ID       string                 `json:"id"`
	UserID   string                 `json:"userId"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}
