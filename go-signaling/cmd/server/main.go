package main

import (
	"flag"
	"log"

	"github.com/beacon/signaling/internal/server"
	"github.com/joho/godotenv"
)

var addr = flag.String("addr", ":8080", "http service address")

func main() {
	godotenv.Load()
	flag.Parse()
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	srv := server.NewServer()
	srv.Start(*addr)
}
