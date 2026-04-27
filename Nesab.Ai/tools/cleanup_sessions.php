<?php
/**
 * Nesab AI — Session Cleanup Script (cron-safe)
 *
 * Server path: public_html/api.nesab.sa/tools/cleanup_sessions.php
 * Sessions dir: public_html/api.nesab.sa/memory/sessions/
 *
 * cPanel cron example (daily at 3:00 AM):
 *   0 3 * * * php /home/<user>/public_html/api.nesab.sa/tools/cleanup_sessions.php
 *
 * Can also be called via HTTP if you protect it (IP whitelist or secret token).
 * As-is it is safe to expose — it only deletes files, outputs plain text.
 */

define('SESSION_MAX_AGE', 604800); // 7 days in seconds

$sessionsDir = __DIR__ . '/../memory/sessions';

if (!is_dir($sessionsDir)) {
    echo "Sessions directory not found: $sessionsDir\n";
    exit(1);
}

$files   = glob($sessionsDir . '/*.json') ?: [];
$cutoff  = time() - SESSION_MAX_AGE;
$deleted = 0;
$errors  = 0;

foreach ($files as $file) {
    $mtime = @filemtime($file);
    if ($mtime === false) {
        continue;
    }
    if ($mtime < $cutoff) {
        if (@unlink($file)) {
            $deleted++;
        } else {
            $errors++;
        }
    }
}

echo "Cleanup done. Deleted: $deleted file(s). Errors: $errors.\n";
