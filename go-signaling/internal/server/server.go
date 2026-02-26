package server

import (
	"log"
	"net/http"

	"github.com/beacon/signaling/internal/signaling"
)

type Server struct {
	Hub *signaling.Hub
}

func NewServer() *Server {
	return &Server{
		Hub: signaling.NewHub(),
	}
}

func (s *Server) Start(addr string) {
	go s.Hub.Run()
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		signaling.ServeWs(s.Hub, w, r)
	})
	
	// Add health check
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	log.Printf("Beacon V2 Signaling Server starting on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
