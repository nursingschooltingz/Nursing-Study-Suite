# Archived Anki Audit Scripts (`v16.6` Era)

These eight one-off `audit-anki-*` and `reaudit-anki-*` scripts were authored during the `v16.x` Anki source-audit investigation and were never wired into `verify-repo.js` or `latte-tests.js`. Several reference the retired `Nursing-Study-Suite v16.6.html` filename or pre-hoist extraction anchors and therefore fail against `v21.10`.

Active Anki source-audit, lifecycle, review-queue, and browser coverage lives under `tools/` and executes through `node verify-repo.js` (`latte-tests.js`). These historical scripts are preserved here for audit-trail reference only.
