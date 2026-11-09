# Code review guidance for this repository

This file tells the code reviewer what this repository already decided, so review rounds are spent on new problems.

## Severity

- **High / Medium** — a concrete change you can name, whose result can be checked by lint, typecheck, a test, or a stated fact (a command and its output, a line of documentation).
- **Low** — suggestions, style, wording, naming, and architecture opinions. Useful, but the PR can merge without them.

Put each finding at the lowest severity you can defend.

## Report everything in one review

List every problem you find in the current diff in the same review. Findings that first appear in a later round as "previously missed" cost a full extra review cycle here.

At most 5 Low findings per review. If there are more, add one summary line with the count.

## Do not comment on

- **Frozen paths:** `test/e2e/specs/`, `spec/gherkin-feature/`, `spec/e2e-flows/`. These change only through the spec workflow; existing files are blocked by a hook. Do not suggest edits there.
- **Generated or binary files:** `package-lock.json`, `server/db/migrations/meta/`, `docs/demo/`, `docs/screenshots/`.
- **What CI already enforces:** ESLint (`npm run eslint`, which also runs `scripts/visual-hierarchy-check.mjs`), typecheck (`npm run typelint`), unit tests, E2E results, and OSV-Scanner (new vulnerabilities in `package-lock.json`). Do not repeat a finding that a failing CI check would already show.

## Already decided — do not raise again

- **Authentication is a single 7-day JWT with no refresh token.** There is no `/auth/refresh` endpoint and none is planned. Do not suggest adding refresh tokens, refresh rotation, or 401-retry logic.
- **Pinia persisted state is stored in cookies on purpose** (`@pinia/nuxt` + persistedstate default), so server-side rendering can read it. Do not suggest moving it to `localStorage`.
- **The app is locked to light mode** (`colorMode: false`). Missing or unused `dark:` classes are not a bug.
- **The rundown `guestVisible` flag is a display filter, not a security boundary.** The staff rundown pages and the guest schedule (`guest-schedule.get.ts`) render the same data differently.
- **The couple's own wedding (`landingWeddingId` in `nuxt.config.ts`) allows public reads and RSVP without a signed link** (issue #163). Unsigned access to that one wedding's public pages is intended.
- **`frozen-paths-guard.mjs` is a static text parser, not a sandbox.** Its file header has a numbered "已知極限" (known limits) list of bypasses that were tested and accepted. Only report a bypass if it is not covered by that list.
- **macOS `/usr/bin/grep` supports `--include` and `--exclude-dir`.** Verified on 2026-09-23 (`grep 2.6.0-FreeBSD`). Do not flag these flags as GNU-only.
- **GitHub-hosted runners clean up background processes at the end of the job, not the end of the step.** A server started in one step is still running in the next.
- **`git push` updates the remote-tracking ref `origin/<branch>`.** Reading `origin/<branch>` right after our own push is not stale.
