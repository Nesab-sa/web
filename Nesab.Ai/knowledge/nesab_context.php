<?php
/**
 * Nesab AI — Context-Aware Knowledge Injector
 *
 * يُستدعى من chat.php لإضافة معرفة ساما المناسبة للسياق الحالي.
 *
 * الاستخدام في chat.php:
 *   require_once __DIR__ . '/knowledge/sama_rules.php';
 *   require_once __DIR__ . '/knowledge/nesab_context.php';
 *   ...
 *   $systemPrompt .= get_relevant_knowledge($context);
 *
 * $context = page slug المُرسل من الـ frontend، مثل: "shakhsi-plus", "aqari-aadi"
 */

/**
 * Returns SAMA knowledge blocks relevant to the given page context.
 * Always appends general_disclaimer at the end.
 *
 * @param  string $context  Page slug sent from nesab-ai.js (e.g. "shakhsi-plus")
 * @return string           Formatted knowledge text to append to system prompt
 */
function get_relevant_knowledge(string $context): string
{
    // sama_rules.php must be required before this file.
    // $SAMA_KNOWLEDGE_BLOCKS is defined there as a global variable.
    global $SAMA_KNOWLEDGE_BLOCKS;

    // ── Context → Block Mapping ───────────────────────────────────────────────
    // Each page slug maps to the knowledge blocks most relevant to that page.
    // 'general_disclaimer' is always appended separately at the end.
    $contextMap = [

        // القرض الشخصي المختصر
        'shakhsi-mukhtasar' => ['deduction_general', 'personal_loan_fees'],

        // القرض الشخصي المتقدم (مع بطاقات وعقار)
        'shakhsi-plus'      => ['deduction_general', 'personal_loan_fees'],

        // التمويل العقاري
        'aqari-aadi'        => ['deduction_general', 'mortgage_rules'],

        // نسبة الاستقطاع
        'nisbat-alistiqtaa' => ['deduction_general'],

        // هل أستطيع أخذ قرض (استقطاع نعم/لا)
        'istiqtaa-naam-la'  => ['deduction_general', 'personal_loan_fees'],

        // تمويل مركبات تجاري (نسبة الاستقطاع للتأجير التمويلي 45%)
        'tajiri-aadi'       => ['deduction_general'],

        // نقاط البيع
        'niqat-albay'       => ['pos_rules'],

        // الودائع البنكية — خيرات
        'khayrat'           => ['savings_rules'],

        // حماية الادخار
        'himaya-iddikhar'   => ['savings_rules'],
    ];

    // ── Resolve blocks for this context ──────────────────────────────────────
    $blockKeys = $contextMap[$context] ?? [];

    // If context is unknown or empty, inject all blocks as a safe fallback
    if (empty($blockKeys)) {
        $blockKeys = ['deduction_general', 'personal_loan_fees', 'mortgage_rules',
                      'pos_rules', 'savings_rules'];
    }

    // Always add founder profile and disclaimer
    $blockKeys[] = 'founder_profile';
    $blockKeys[] = 'general_disclaimer';

    // ── Build output string ───────────────────────────────────────────────────
    $output = "\n\n---\n## معلومات إضافية لهذه الصفحة\n";
    foreach ($blockKeys as $key) {
        if (isset($SAMA_KNOWLEDGE_BLOCKS[$key])) {
            $output .= $SAMA_KNOWLEDGE_BLOCKS[$key] . "\n";
        }
    }

    return $output;
}
