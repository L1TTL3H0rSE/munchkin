package postgres

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
)

const migrationLockID int64 = 2026073101

const migrationLedgerDDL = `
CREATE TABLE IF NOT EXISTS munchkin_schema_migrations (
    version TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`

type migrationFile struct {
	version  string
	checksum string
	sql      string
}

func (store *Store) Migrate(ctx context.Context, configuredPath string) error {
	migrations, err := loadMigrations(configuredPath)
	if err != nil {
		return err
	}
	tx, err := store.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock($1)", migrationLockID); err != nil {
		return fmt.Errorf("acquire migration lock: %w", err)
	}
	if _, err := tx.Exec(ctx, migrationLedgerDDL); err != nil {
		return fmt.Errorf("create migration ledger: %w", err)
	}
	for _, migration := range migrations {
		var appliedChecksum string
		err := tx.QueryRow(
			ctx,
			"SELECT checksum FROM munchkin_schema_migrations WHERE version = $1",
			migration.version,
		).Scan(&appliedChecksum)
		switch {
		case errors.Is(err, pgx.ErrNoRows):
		case err != nil:
			return fmt.Errorf("read migration ledger for %s: %w", migration.version, err)
		case appliedChecksum != migration.checksum:
			return fmt.Errorf("migration checksum mismatch for %s", migration.version)
		default:
			continue
		}
		if _, err := tx.Exec(ctx, migration.sql); err != nil {
			return fmt.Errorf("apply migration %s: %w", migration.version, err)
		}
		if _, err := tx.Exec(
			ctx,
			`INSERT INTO munchkin_schema_migrations (version, checksum)
             VALUES ($1, $2)`,
			migration.version,
			migration.checksum,
		); err != nil {
			return fmt.Errorf("record migration %s: %w", migration.version, err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit migrations: %w", err)
	}
	return nil
}

func loadMigrations(configuredPath string) ([]migrationFile, error) {
	paths, err := migrationPaths(configuredPath)
	if err != nil {
		return nil, err
	}
	migrations := make([]migrationFile, 0, len(paths))
	for _, migrationPath := range paths {
		raw, err := os.ReadFile(migrationPath)
		if err != nil {
			return nil, err
		}
		migrations = append(migrations, migrationFile{
			version:  filepath.Base(migrationPath),
			checksum: fmt.Sprintf("%x", sha256.Sum256(raw)),
			sql:      string(raw),
		})
	}
	return migrations, nil
}

func migrationPaths(configuredPath string) ([]string, error) {
	info, err := os.Stat(configuredPath)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		return []string{configuredPath}, nil
	}
	entries, err := os.ReadDir(configuredPath)
	if err != nil {
		return nil, err
	}
	paths := make([]string, 0)
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".up.sql") {
			continue
		}
		paths = append(paths, filepath.Join(configuredPath, entry.Name()))
	}
	sort.Strings(paths)
	if len(paths) == 0 {
		return nil, fmt.Errorf("no .up.sql migrations in %s", configuredPath)
	}
	return paths, nil
}
