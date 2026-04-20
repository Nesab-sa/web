<?php
/**
 * Nesab AI — Request Logger
 *
 * Appends one NDJSON line per request to logs/chat.log.
 * NDJSON (newline-delimited JSON) = one valid JSON object per line,
 * easy to grep, tail, or pipe into any log analysis tool later.
 *
 * Fails silently — a logging failure must never break the user response.
 *
 * ── Log line fields ────────────────────────────────────────────────────────────
 *  ts          ISO-8601 timestamp (Asia/Riyadh)
 *  client      clientId (IP or Firebase UID prefix — same as rate limiter)
 *  ctx         page context slug sent by frontend (e.g. "shakhsi-plus")
 *  tool        calculator function name if a tool was called, else null
 *  msg_len     character length of the user message (after guard_input)
 *  reply_len   character length of the final AI reply
 *  latency_ms  wall-clock milliseconds from request start to log call
 *  status      "ok" | "error"
 */

define('LOG_FILE', __DIR__ . '/../logs/chat.log');
define('LOG_MAX_BYTES', 10 * 1024 * 1024);   // 10 MB — rotate awareness threshold


/**
 * Append a structured log entry for the current request.
 *
 * @param string      $clientId   Sanitized client identifier
 * @param string      $context    Page slug (may be empty string)
 * @param string|null $toolUsed   calc_* function name, or null if no tool called
 * @param int         $msgLen     Character length of cleaned user message
 * @param int         $replyLen   Character length of final reply
 * @param float       $startTime  microtime(true) captured at request start
 * @param string      $status     "ok" or "error"
 */
function log_request(
    string  $clientId,
    string  $context,
    ?string $toolUsed,
    int     $msgLen,
    int     $replyLen,
    float   $startTime,
    string  $status = 'ok'
): void {
    // ── Soft rotation warning ─────────────────────────────────────────────────
    // We don't rotate automatically (no shell access from PHP safely),
    // but we skip writing if the file is clearly over the threshold.
    // Alert: monitor this manually or add a cron to rotate logs/chat.log.
    if (file_exists(LOG_FILE) && filesize(LOG_FILE) > LOG_MAX_BYTES) {
        return;  // silent — avoids filling disk; operator should rotate
    }

    $entry = json_encode([
        'ts'         => date('c'),                                  // ISO-8601 with timezone
        'client'     => $clientId,
        'ctx'        => $context ?: null,
        'tool'       => $toolUsed,
        'msg_len'    => $msgLen,
        'reply_len'  => $replyLen,
        'latency_ms' => (int) round((microtime(true) - $startTime) * 1000),
        'status'     => $status,
    ], JSON_UNESCAPED_UNICODE);

    // Append with newline — LOCK_EX for concurrent-safe writes
    @file_put_contents(LOG_FILE, $entry . "\n", FILE_APPEND | LOCK_EX);
}
