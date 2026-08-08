//go:build munchkin_e2e

package main

import (
	"log"
	"os"
	"strconv"

	"github.com/leinodev/munchkin/backend/game/internal/application"
)

func configureDeterministicTestRandom(service *application.Service) {
	if os.Getenv("MUNCHKIN_TEST_MODE") != "1" {
		return
	}
	seed, err := strconv.ParseUint(os.Getenv("MUNCHKIN_TEST_RANDOM_SEED"), 10, 64)
	if err != nil {
		log.Fatalf("parse MUNCHKIN_TEST_RANDOM_SEED: %v", err)
	}
	service.SetDeterministicRandomForTesting(seed)
}
