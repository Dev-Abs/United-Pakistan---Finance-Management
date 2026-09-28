# UI rebuild rollback

Stage 0 was attempted on 2026-09-28.

- Current source branch: `main`
- Requested backup branch: `backup/pre-ui-20260928`
- Requested working branch: `ui/rebuild`
- Snapshot commit: not created
- Reason: Git metadata is read-only in this workspace; branch creation and commit failed with `Permission denied` while locking `.git/refs` and `.git/index.lock`.
- Recovery when Git write access is available: create the backup branch from the current `main` HEAD, commit the pre-rebuild snapshot, then create `ui/rebuild` from that commit.

No product files were changed before this note.
