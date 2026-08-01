package postgres

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadMigrationsUsesVersionAndContentChecksum(t *testing.T) {
	directory := t.TempDir()
	path := filepath.Join(directory, "000001_first.up.sql")
	if err := os.WriteFile(path, []byte("CREATE TABLE first_table (id TEXT);\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	migrations, err := loadMigrations(directory)
	if err != nil {
		t.Fatal(err)
	}
	if len(migrations) != 1 || migrations[0].version != "000001_first.up.sql" {
		t.Fatalf("migrations=%#v", migrations)
	}
	if migrations[0].checksum == "" || migrations[0].sql == "" {
		t.Fatalf("migration metadata=%#v", migrations[0])
	}
	if err := os.WriteFile(path, []byte("CREATE TABLE changed_table (id TEXT);\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	changed, err := loadMigrations(directory)
	if err != nil {
		t.Fatal(err)
	}
	if changed[0].checksum == migrations[0].checksum {
		t.Fatal("migration checksum did not change with file content")
	}
}

func TestMigrationPathsSelectOnlySortedUpFiles(t *testing.T) {
	directory := t.TempDir()
	for _, name := range []string{
		"000002_second.up.sql",
		"000001_first.up.sql",
		"000002_second.down.sql",
		"README.md",
	} {
		if err := os.WriteFile(
			filepath.Join(directory, name),
			[]byte("-- fixture"),
			0o600,
		); err != nil {
			t.Fatal(err)
		}
	}
	paths, err := migrationPaths(directory)
	if err != nil {
		t.Fatal(err)
	}
	if len(paths) != 2 ||
		filepath.Base(paths[0]) != "000001_first.up.sql" ||
		filepath.Base(paths[1]) != "000002_second.up.sql" {
		t.Fatalf("migration paths: %#v", paths)
	}
}
