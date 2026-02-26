package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"net/url"
	"os"
	"os/signal"
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"

	"github.com/beacon/signaling/internal/auth"
)

var (
	addr       = flag.String("addr", "localhost:8080", "http service address")
	numClients = flag.Int("clients", 1000, "number of concurrent clients")
	numRooms   = flag.Int("rooms", 500, "number of rooms")
	duration   = flag.Duration("duration", 30*time.Second, "test duration")
)

type Message struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload,omitempty"`
	Sender  string      `json:"sender,omitempty"`
	Target  string      `json:"target,omitempty"` 
}

type JoinPayload struct {
	RoomID   string                 `json:"roomId"`
	UserID   string                 `json:"userId"`
	Metadata map[string]interface{} `json:"metadata"`
}

type PingPayload struct {
	Timestamp int64 `json:"timestamp"`
}

var (
	connectedClients int64
	messagesSent     int64
	messagesRecv     int64
	totalLatency     int64
	errors           int64
)

func main() {
	flag.Parse()
	log.SetFlags(0)

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	u := url.URL{Scheme: "ws", Host: *addr, Path: "/ws"}
	log.Printf("connecting to %s with %d clients in %d rooms", u.String(), *numClients, *numRooms)
	
	validator := auth.NewTokenValidator()

	var wg sync.WaitGroup
	start := time.Now()

	// Launch clients
	for i := 0; i < *numClients; i++ {
		wg.Add(1)
		go runClient(i, u.String(), &wg)
		// Small delay to avoid thundering herd on connect
		if i%50 == 0 {
			time.Sleep(10 * time.Millisecond)
		}
	}

	// Monitor stats
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				elapsed := time.Since(start).Seconds()
				sent := atomic.LoadInt64(&messagesSent)
				recv := atomic.LoadInt64(&messagesRecv)
				conn := atomic.LoadInt64(&connectedClients)
				lat := atomic.LoadInt64(&totalLatency)
				errs := atomic.LoadInt64(&errors)
				
				avgLat := 0.0
				if recv > 0 {
					avgLat = float64(lat) / float64(recv) / 1e6 // ms
				}

				var m runtime.MemStats
				runtime.ReadMemStats(&m)

				fmt.Printf("\rT+%.0fs | Clients: %d | Sent: %d | Recv: %d | AvgLat: %.2fms | Errs: %d | Alloc: %d MB",
					elapsed, conn, sent, recv, avgLat, errs, m.Alloc/1024/1024)
			case <-interrupt:
				return
			}
		}
	}()

	// Wait for duration or interrupt
	select {
	case <-time.After(*duration):
		log.Println("\nTest duration reached")
	case <-interrupt:
		log.Println("\nInterrupted")
	}

	// Calculate final stats
	elapsed := time.Since(start).Seconds()
	sent := atomic.LoadInt64(&messagesSent)
	recv := atomic.LoadInt64(&messagesRecv)
	lat := atomic.LoadInt64(&totalLatency)
	
	avgLat := 0.0
	if recv > 0 {
		avgLat = float64(lat) / float64(recv) / 1e6 // ms
	}

	fmt.Printf("\n--- Final Results ---\n")
	fmt.Printf("Duration: %.2fs\n", elapsed)
	fmt.Printf("Clients: %d\n", *numClients)
	fmt.Printf("Messages Sent: %d (%.2f/s)\n", sent, float64(sent)/elapsed)
	fmt.Printf("Messages Recv: %d (%.2f/s)\n", recv, float64(recv)/elapsed)
	fmt.Printf("Avg Latency: %.2fms\n", avgLat)
	fmt.Printf("Errors: %d\n", atomic.LoadInt64(&errors))
}

func runClient(id int, baseURL string, wg *sync.WaitGroup) {
	defer wg.Done()

	// Generate token
	validator := auth.NewTokenValidator()
	userID := fmt.Sprintf("user-%d", id)
	token, _ := validator.GenerateToken(userID)

	// Build URL with token
	u, _ := url.Parse(baseURL)
	q := u.Query()
	q.Set("token", token)
	u.RawQuery = q.Encode()

	c, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		atomic.AddInt64(&errors, 1)
		// log.Printf("handshake failed: %v", err)
		return
	}
	defer c.Close()

	atomic.AddInt64(&connectedClients, 1)
	defer atomic.AddInt64(&connectedClients, -1)

	// Join room
	roomID := fmt.Sprintf("room-%d", id%*numRooms)
	userID := fmt.Sprintf("user-%d", id)
	
	joinMsg := Message{
		Type: "join",
		Payload: JoinPayload{
			RoomID: roomID,
			UserID: userID,
			Metadata: map[string]interface{}{"role": "tester"},
		},
	}
	
	if err := c.WriteJSON(joinMsg); err != nil {
		atomic.AddInt64(&errors, 1)
		return
	}

	// Start reading
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				return
			}
			
			var msg Message
			if err := json.Unmarshal(message, &msg); err != nil {
				continue
			}

			if msg.Type == "offer" {
				// Calculate latency
				// Extract timestamp from payload
				payloadBytes, _ := json.Marshal(msg.Payload)
				var ping PingPayload
				json.Unmarshal(payloadBytes, &ping)
				
				if ping.Timestamp > 0 {
					latency := time.Now().UnixNano() - ping.Timestamp
					atomic.AddInt64(&totalLatency, latency)
					atomic.AddInt64(&messagesRecv, 1)
				}
			}
		}
	}()

	// Start sending periodically
	ticker := time.NewTicker(time.Duration(100+rand.Intn(900)) * time.Millisecond) // Random interval 100ms-1s
	defer ticker.Stop()

	for {
		select {
		case <-done:
			return
		case <-ticker.C:
			payload := PingPayload{Timestamp: time.Now().UnixNano()}
			msg := Message{
				Type: "offer", // Using 'offer' as generic signaling message
				Payload: payload,
			}
			if err := c.WriteJSON(msg); err != nil {
				atomic.AddInt64(&errors, 1)
				return
			}
			atomic.AddInt64(&messagesSent, 1)
		}
	}
}
