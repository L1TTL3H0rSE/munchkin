//go:build !munchkin_e2e

package main

import (
	"log"
	"os"

	"github.com/leinodev/munchkin/backend/game/internal/application"
)

func configureDeterministicTestRandom(_ *application.Service) {
	if os.Getenv("MUNCHKIN_TEST_MODE") != "" || os.Getenv("MUNCHKIN_TEST_RANDOM_SEED") != "" {
		log.Fatal("deterministic test random requires a server built with -tags=munchkin_e2e")
	}
}
