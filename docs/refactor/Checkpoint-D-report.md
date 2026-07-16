# Checkpoint D Report

Date: 2026-07-15

Branch: `codex/r0-phase-d`

## Scope

Phase D completed the MySQL infrastructure foundation for R0:

- Task 13: Docker Compose MySQL and Redis services
- Task 14: MySQL connection pool and health checks
- Task 15: Versioned MySQL migration runner
- Task 16: Deterministic seed profiles and test database lifecycle

This checkpoint does not switch any business domain from SQLite to MySQL. Domain-by-domain Repository migration starts in Phase E after user confirmation.

## Implemented

### Migration

- Added `schema_migrations` bootstrap table.
- Added 15 ordered R0 migration pairs from `0010` to `0150`.
- Added migration runner with:
  - MySQL named lock
  - ordered execution
  - up/down file pair validation
  - SHA-256 checksum validation
  - repeat execution protection
  - down execution in reverse order
  - sanitized error output
- Added CLI scripts:
  - `db:migrate`
  - `db:rollback`
  - `db:migrate:status`

### Seed

- Added Reference Seed:
  - 3 roles: `student`, `counselor`, `super_admin`
  - 12 core permissions
  - 15 role-permission mappings
  - 6 reference emotion types
  - 6 system tags
- Added Demo Seed:
  - fixed fictional usernames: `demo_student`, `demo_counselor`, `demo_super_admin`
  - requires `ALLOW_DEMO_SEED=true`
  - reads password from `DEMO_PASSWORD`
  - encrypts demo mood text with `ENCRYPTION_KEY`
  - creates 5 fictional mood records across the recent trend window
- Added Test Seed:
  - creates only `TECHNICAL_FIXTURE`
  - keeps the fixture in `draft`
  - does not create SDS/SAS or any active psychological scale
- Added CLI scripts:
  - `db:seed:reference`
  - `db:seed:demo`
  - `db:seed:test`
  - `db:seed:all`

## Verification Evidence

### Automated tests

Command:

```powershell
npx jest tests/unit/db/migrationFiles.test.ts tests/unit/db/migrationRunner.test.ts tests/unit/db/seedCore.test.ts tests/unit/db/seedProfiles.test.ts tests/unit/config/mysql.test.ts --runInBand
```

Result:

- 5 suites passed
- 21 tests passed

Command:

```powershell
npm --prefix mood_health_server run build
```

Result:

- TypeScript build passed

### Real MySQL migration verification

Verified on a temporary MySQL database:

- `db:migrate`
- `db:migrate:status`
- `db:rollback`
- `db:migrate`
- repeat `db:migrate`

Observed:

- first migrate: `Applied 15 migration(s), skipped 0`
- repeat migrate: `Applied 0 migration(s), skipped 15`
- table count after migration: 16
- migration records: 15

### Real MySQL seed verification

Verified on a temporary MySQL database:

- `db:migrate`
- `db:seed:reference` twice
- `db:seed:demo` twice
- `db:seed:test` twice

Observed final counts:

- `roles`: 3
- `permissions`: 12
- `role_permissions`: 15
- `emotion_types`: 6
- `tags`: 6
- `users`: 3
- `moods`: 5
- `mood_emotions`: 5
- `assessment_instruments`: 1
- `assessment_versions`: 1
- plaintext demo mood count: 0

## Known Non-Blocking Findings

- Full legacy backend unit suite still has pre-existing SQLite mood test failures caused by fixed old test data and foreign-key lifecycle issues. This is already within the approved Task 16/Phase E/F cleanup path and was not introduced by the MySQL migration/seed work.
- Compose currently creates the default MySQL app user through the official image. Dedicated least-privilege operational users (`mood_migrator`, `mood_test`) are represented in configuration and seed/migration commands, but a separate provisioning script can be added later if required for production hardening.

## Checkpoint D Status

Task 13 through Task 16 are complete and pushed.

Checkpoint D is ready for user review. After approval, the next phase is Phase E: domain-by-domain migration to MySQL Repository.
