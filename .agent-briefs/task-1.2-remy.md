# Task 1.2 — SQLCipher Database (Remy)

## YOUR ROLE
You are Remy, a backend engineer agent. Build the encrypted SQLCipher database with Drizzle ORM for Psygil.

## PROJECT LOCATION
`/Users/truckirwin/Desktop/Foundry SMB/Products/Psygil`

## MANDATORY: READ FIRST
Before writing any code, read:
1. `/Users/truckirwin/Desktop/Foundry SMB/Products/Psygil/BUILD_MANIFEST.md`
2. `/Users/truckirwin/Desktop/Foundry SMB/Products/Psygil/docs/engineering/01_database_schema.sql` — ALL 14 tables
3. `/Users/truckirwin/Desktop/Foundry SMB/Products/Psygil/docs/engineering/01a_schema_addendum_shared_storage.sql` — addendum tables

## DEPENDENCY
Task 1.1 (scaffold) must be done first. The `app/` directory must exist.

## YOUR TASK: Task 1.2 — SQLCipher database with Drizzle ORM

## ACCEPTANCE CRITERIA
- All 14 tables created in correct schema
- Seed data loaded (at minimum: 1 user, sample diagnosis catalog entries, sample instrument library entries)
- AES-256 encryption verified (file is not readable as plaintext)
- Drizzle ORM schema matches SQL schema exactly
- Migration runs without errors

## WHAT TO BUILD
Inside `app/src/main/`:

```
db/
  schema.ts         (Drizzle table definitions for all 14 tables)
  migrations/       (Drizzle migration files)
  seed.ts           (seed data: 1 test user, DSM-5 catalog entries, instrument library)
  index.ts          (DB connection: open SQLCipher db, set pragma key, return drizzle instance)
  verify.ts         (simple test: insert + retrieve + confirm encrypted)
```

## TECHNICAL REQUIREMENTS
- SQLCipher package: use `@journeyapps/sqlcipher` — best macOS arm64 compatibility in Electron
- Drizzle ORM: `drizzle-orm` + `drizzle-kit`
- Key derivation: Argon2id (use `argon2` npm package to derive key from passphrase)
- Pragma settings from schema: `PRAGMA foreign_keys = ON` + `PRAGMA key = '...'`
- DB file location: `app.getPath('userData')/psygil.db` in Electron main
- For development/testing: use a fixed test passphrase `'psygil-dev-key-2026'`

## CONSTRAINTS
- Do NOT build any UI
- Do NOT connect to Auth0 or any external service
- Do NOT touch renderer or preload
- Stay inside `app/src/main/db/`

## DONE WHEN
`npm run db:migrate` runs without errors, DB file exists, and `npm run db:verify` confirms encryption (file cannot be opened as plaintext SQLite).

## NOTIFY WHEN DONE
When completely finished, run:
`openclaw system event --text "Task 1.2 done: SQLCipher DB with all 14 tables, Drizzle ORM, encryption verified" --mode now`
