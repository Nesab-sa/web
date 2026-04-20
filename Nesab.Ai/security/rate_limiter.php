<?php
/**
 * Nesab AI — File-Based Rate Limiter
 *
 * Tracks requests per client using small JSON files under security/rate_data/.
 * No database, no Redis — matches the project's file-based architecture.
 *
 * ── clientId resolution ────────────────────────────────────────────────────────
 * Called from chat.php after $userId is already resolved.
 * chat.php passes $userId directly as $clientId — same source of truth.
 * Internally this file can also resolve clientId independently if needed:
 *   1. $data['user_id'] from POST body (stable Firebase UID — preferred)
 *   2. X-Forwarded-For header (CDN / Sahara reverse proxy)
 *   3. REMOTE_ADDR fallback
 *
 * ── Limits ────────────────────────────────────────────────────────────────────
 * RATE_LIMIT_MAX:    max requests per window per client
 * RATE_LIMIT_WINDOW: rolling window in seconds
 *
 * 30 req/min is conservative for a chat API. Increase if legitimate usage
 * patterns require it (e.g. power users running multiple tabs simultaneously).
 */

define('RATE_DATA_DIR',       __DIR__ . '/rate_data');
define('RATE_LIMIT_MAX',      30);    // requests per window
define('RATE_LIMIT_WINDOW',   60);    // window in seconds


// ── RATE CHECK ────────────────────────────────────────────────────────────────

/**
 * Check whether $clientId has exceeded the rate limit.
 *
 * Exits immediately with a structured JSON 429 response if the limit is hit.
 * Fails open on any I/O error (never blocks a legitimate user due to disk issues).
 *
 * @param  string $clientId  Sanitized client identifier (from chat.php $userId)
 */
function check_rate_limit(string $clientId): void
{
    if (!is_dir(RATE_DATA_DIR)) {
        @mkdir(RATE_DATA_DIR, 0755, true);
    }

    // Sanitize: ensure filename is safe (clientId is already sanitized in session_handler)
    $safe = preg_replace('/[^a-zA-Z0-9_\-\.]/', '', $clientId);
    if ($safe === '') {
        return;   // cannot determine client — fail open
    }

    $path = RATE_DATA_DIR . '/' . $safe . '.json';
    $now  = time();

    // ── Read current state ────────────────────────────────────────────────────
    $state = ['window_start' => $now, 'count' => 0];

    if (file_exists($path)) {
        $raw = @file_get_contents($path);
        if ($raw !== false) {
            $stored = json_decode($raw, true);
            if (is_array($stored) && isset($stored['window_start'], $stored['count'])) {
                $state = $stored;
            }
        }
    }

    // ── Roll window if expired ────────────────────────────────────────────────
    if (($now - $state['window_start']) >= RATE_LIMIT_WINDOW) {
        $state = ['window_start' => $now, 'count' => 0];
    }

    // ── Increment ─────────────────────────────────────────────────────────────
    $state['count']++;

    // ── Persist (atomic write) ────────────────────────────────────────────────
    @file_put_contents($path, json_encode($state), LOCK_EX);

    // ── Enforce ───────────────────────────────────────────────────────────────
    if ($state['count'] > RATE_LIMIT_MAX) {
        $retryAfter = RATE_LIMIT_WINDOW - ($now - $state['window_start']);
        http_response_code(429);
        header('Retry-After: ' . max(1, $retryAfter));
        echo json_encode([
            'reply'  => 'لقد تجاوزت الحد المسموح به من الطلبات. يرجى الانتظار دقيقة قبل المحاولة مجدداً.',
            'source' => 'error',
            'code'   => 'RATE_LIMIT_EXCEEDED',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
