<?php
/**
 * Nesab AI — Session Memory Handler
 *
 * Stores per-user conversation history as JSON files under memory/sessions/.
 * No database, no Redis — file-based only. Safe fallback on any I/O error.
 *
 * ── userId resolution order ───────────────────────────────────────────────────
 * 1. $data['user_id'] from POST body  ← preferred, stable Firebase UID or similar
 *    The frontend (nesab-ai.js) should pass user_id once authentication is wired.
 * 2. X-Forwarded-For header          ← covers CDN / reverse-proxy setups
 * 3. REMOTE_ADDR                     ← last resort; not stable for mobile/dynamic IPs
 *
 * Upgrade path: replace REMOTE_ADDR fallback with a token/cookie once the app
 * sends a stable identifier. No change to the rest of the system is needed.
 *
 * ── Memory limits ─────────────────────────────────────────────────────────────
 * SESSION_MAX_MESSAGES: total role messages kept per user (user + assistant).
 * 24 messages = 12 conversation turns. Oldest are dropped when the cap is hit.
 */

define('SESSION_DIR',          __DIR__ . '/sessions');
define('SESSION_MAX_MESSAGES', 24);   // 12 turns (user+assistant pairs)


// ── USER ID RESOLUTION ────────────────────────────────────────────────────────

/**
 * Extract a stable, filesystem-safe user identifier from the POST payload.
 *
 * @param  array $data  Decoded POST body
 * @return string       Sanitized user ID (safe for use as filename)
 */
function resolve_user_id(array $data): string
{
    // 1. Explicit user_id from app (preferred — send Firebase UID or session token)
    if (!empty($data['user_id']) && is_string($data['user_id'])) {
        // Allow only alphanumeric, dash, underscore — strip everything else
        $clean = preg_replace('/[^a-zA-Z0-9_\-]/', '', $data['user_id']);
        if (strlen($clean) >= 4) {   // sanity minimum length
            return $clean;
        }
    }

    // 2. X-Forwarded-For (behind CDN or Sahara reverse proxy)
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ip = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
        return 'ip_' . preg_replace('/[^0-9a-fA-F\.\:]/', '', $ip);
    }

    // 3. Direct REMOTE_ADDR fallback
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    return 'ip_' . preg_replace('/[^0-9a-fA-F\.\:]/', '', $ip);
}


// ── PATH HELPER ───────────────────────────────────────────────────────────────

function _session_path(string $userId): string
{
    return SESSION_DIR . '/' . $userId . '.json';
}


// ── LOAD ──────────────────────────────────────────────────────────────────────

/**
 * Load persisted conversation history for a user.
 *
 * Returns an array of OpenAI-format messages:
 *   [['role' => 'user', 'content' => '...'], ['role' => 'assistant', 'content' => '...'], ...]
 *
 * Returns [] on any failure (missing file, corrupt JSON, permission error).
 * This means a failed load is transparent — the chat continues without history.
 *
 * @param  string $userId
 * @return array
 */
function load_session(string $userId): array
{
    $path = _session_path($userId);

    if (!file_exists($path)) {
        return [];   // first visit — no history yet
    }

    $raw = @file_get_contents($path);
    if ($raw === false) {
        return [];   // permission or I/O error — fail silently
    }

    $stored = json_decode($raw, true);
    if (!is_array($stored) || !isset($stored['messages']) || !is_array($stored['messages'])) {
        return [];   // malformed — fail silently, file will be overwritten on next save
    }

    return $stored['messages'];
}


// ── SAVE ──────────────────────────────────────────────────────────────────────

/**
 * Persist new conversation messages for a user.
 *
 * Only 'user' and 'assistant' roles are stored.
 * System messages, tool messages, and tool_calls are intentionally excluded
 * — those are re-injected on each request from chat.php logic.
 *
 * The function merges $newMessages onto the existing history, then trims
 * to SESSION_MAX_MESSAGES keeping the most recent messages.
 *
 * Fails silently on any write error — never breaks the response to the user.
 *
 * @param  string $userId
 * @param  array  $newMessages  Fresh messages to append, e.g.:
 *                              [
 *                                ['role' => 'user',      'content' => $message],
 *                                ['role' => 'assistant', 'content' => $finalReply],
 *                              ]
 */
function save_session(string $userId, array $newMessages): void
{
    // Ensure sessions directory exists (may not exist on first deploy)
    if (!is_dir(SESSION_DIR)) {
        @mkdir(SESSION_DIR, 0755, true);
    }

    // Load existing history (empty array on failure — safe)
    $existing = load_session($userId);

    // Filter: keep only user/assistant roles with non-empty string content
    $filtered = array_filter($newMessages, function (array $msg): bool {
        return isset($msg['role'], $msg['content'])
            && in_array($msg['role'], ['user', 'assistant'], true)
            && is_string($msg['content'])
            && $msg['content'] !== '';
    });

    // Merge existing + new (existing is older, new is appended)
    $merged = array_merge($existing, array_values($filtered));

    // Trim to cap — keep most recent SESSION_MAX_MESSAGES
    if (count($merged) > SESSION_MAX_MESSAGES) {
        $merged = array_slice($merged, -SESSION_MAX_MESSAGES);
    }

    $json = json_encode(
        [
            'user_id'    => $userId,
            'updated_at' => time(),
            'messages'   => $merged,
        ],
        JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT
    );

    // LOCK_EX: atomic write — prevents corruption on concurrent requests
    @file_put_contents(_session_path($userId), $json, LOCK_EX);
}
