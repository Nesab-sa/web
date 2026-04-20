<?php
/**
 * Nesab AI — Input Guard
 *
 * First-line sanitization and validation for all user messages before they
 * reach OpenAI or any internal logic.
 *
 * Goals:
 *   1. Strip invisible/control characters that could corrupt logs or model context.
 *   2. Enforce a hard length cap — prevents token-stuffing and oversized payloads.
 *   3. Block obvious injection patterns (server-side code, SQL, prompt injection).
 *
 * Design philosophy: fail loudly with a structured error (the caller exits).
 * Do NOT silently truncate without informing the user — they should know why
 * their message was rejected so they can rephrase.
 */

define('INPUT_MAX_LENGTH', 1500);   // characters — ample for any legitimate financial question

// ── Injection patterns to block outright ──────────────────────────────────────
// These are obvious attack signatures. The list is intentionally short and
// precise to avoid false positives on Arabic financial text.
const INPUT_BLOCK_PATTERNS = [
    '/<\?php/i',                  // PHP open tag
    '/<\?=/i',                    // PHP short echo
    '/\bDROP\s+TABLE\b/i',        // SQL DDL
    '/\bDELETE\s+FROM\b/i',       // SQL DML
    '/\bINSERT\s+INTO\b/i',       // SQL DML
    '/\bUNION\s+SELECT\b/i',      // SQL injection classic
    '/\bEXEC\s*\(/i',             // SQL/stored proc exec
    '/\beval\s*\(/i',             // JS/PHP eval
    '/\bbase64_decode\s*\(/i',    // encoded payload
    '/<script\b/i',               // XSS
    '/javascript\s*:/i',          // JS protocol
    '/\bignore\s+previous\s+instructions\b/i',  // prompt injection
    '/\bforget\s+(all\s+)?(your\s+)?instructions\b/i', // prompt injection
    '/\byou\s+are\s+now\b.*DAN\b/i',  // jailbreak pattern
];


// ── MAIN GUARD FUNCTION ───────────────────────────────────────────────────────

/**
 * Sanitize and validate a user message.
 *
 * Returns the cleaned message string on success.
 * Exits with a 400 JSON error response on failure — never returns on reject.
 *
 * @param  string $message  Raw user message from POST body
 * @return string           Sanitized message (safe to use)
 */
function guard_input(string $message): string
{
    // ── Step 1: Strip C0/C1 control characters (except tab, newline, CR) ─────
    // Removes null bytes, bell, ESC, and other invisible characters that have
    // no place in a financial question but could poison logs or model context.
    $message = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x80-\x9F]/u', '', $message);

    // ── Step 2: Normalize whitespace — collapse runs of spaces/newlines ───────
    $message = preg_replace('/[ \t]{2,}/', ' ', $message);       // multiple spaces → one
    $message = preg_replace('/\n{3,}/', "\n\n", $message);       // excessive newlines → max 2
    $message = trim($message);

    // ── Step 3: Length check ──────────────────────────────────────────────────
    if (mb_strlen($message, 'UTF-8') > INPUT_MAX_LENGTH) {
        _guard_reject(
            'رسالتك طويلة جداً. الحد الأقصى ' . INPUT_MAX_LENGTH . ' حرف. يرجى اختصار سؤالك.',
            'INPUT_TOO_LONG'
        );
    }

    // ── Step 4: Empty check (after sanitization) ──────────────────────────────
    if ($message === '') {
        _guard_reject('الرسالة فارغة بعد المعالجة.', 'INPUT_EMPTY');
    }

    // ── Step 5: Injection pattern scan ────────────────────────────────────────
    foreach (INPUT_BLOCK_PATTERNS as $pattern) {
        if (preg_match($pattern, $message)) {
            _guard_reject(
                'تم رفض الرسالة لاحتوائها على محتوى غير مسموح به.',
                'INPUT_BLOCKED'
            );
        }
    }

    return $message;
}


// ── REJECT HELPER (internal) ──────────────────────────────────────────────────

/**
 * Emit a 400 error response and exit.
 * Not intended to be called from outside this file.
 *
 * @param string $arabic  Human-readable Arabic error message
 * @param string $code    Machine-readable error code
 */
function _guard_reject(string $arabic, string $code): void
{
    http_response_code(400);
    echo json_encode(
        ['reply' => $arabic, 'source' => 'error', 'code' => $code],
        JSON_UNESCAPED_UNICODE
    );
    exit;
}
