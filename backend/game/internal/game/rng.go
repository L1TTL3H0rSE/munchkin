package game

func nextRandom(state uint64) (value uint64, next uint64) {
	next = state + 0x9e3779b97f4a7c15
	value = next
	value = (value ^ (value >> 30)) * 0xbf58476d1ce4e5b9
	value = (value ^ (value >> 27)) * 0x94d049bb133111eb
	value ^= value >> 31
	return value, next
}

func shuffle(values []string, state uint64) ([]string, uint64) {
	result := append([]string(nil), values...)
	for index := len(result) - 1; index > 0; index-- {
		value, next := nextRandom(state)
		state = next
		swap := int(value % uint64(index+1))
		result[index], result[swap] = result[swap], result[index]
	}
	return result, state
}

func rollD6(state uint64) (int, uint64) {
	value, next := nextRandom(state)
	return int(value%6) + 1, next
}
