<?php
/**
 * Nesab AI — Chat Endpoint
 * https://api.nesab.sa/chat.php
 *
 * Deploy this file to the api.nesab.sa root.
 * Requires config.php in the same directory (never commit config.php).
 *
 * Request:  POST /chat  { "message": "...", "context": "...", "history": [] }
 * Response: { "reply": "...", "source": "ai|error", "calc_used": "...", "calc_result": {} }
 */

// ── CONFIG ───────────────────────────────────────────────────────────────────
$config_path = __DIR__ . '/config.php';
if (!file_exists($config_path)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['reply' => 'خطأ في إعداد الخادم. يرجى التواصل مع الدعم.', 'source' => 'error']);
    exit;
}
require_once $config_path;
require_once __DIR__ . '/tools/calculators.php';
require_once __DIR__ . '/knowledge/sama_rules.php';
require_once __DIR__ . '/knowledge/nesab_context.php';
require_once __DIR__ . '/memory/session_handler.php';
require_once __DIR__ . '/security/rate_limiter.php';
require_once __DIR__ . '/security/input_guard.php';
require_once __DIR__ . '/security/logger.php';

// ── HEADERS ──────────────────────────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['reply' => 'Method not allowed.', 'source' => 'error']);
    exit;
}

// ── INPUT ────────────────────────────────────────────────────────────────────
$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data || empty(trim($data['message'] ?? ''))) {
    http_response_code(400);
    echo json_encode(['reply' => 'الرسالة فارغة.', 'source' => 'error']);
    exit;
}

$message   = trim($data['message']);
$context   = trim($data['context'] ?? '');        // page slug, e.g. "shakhsi-plus"
$history   = is_array($data['history'] ?? null) ? $data['history'] : [];
$userId    = resolve_user_id($data);              // stable ID for memory layer (see session_handler.php)
$clientId  = $userId;                             // same identifier used by rate limiter and logger
$startTime = microtime(true);                     // request start time — used by logger for latency

// ── RATE LIMIT ────────────────────────────────────────────────────────────────
// Exits with HTTP 429 + JSON error if $clientId exceeds RATE_LIMIT_MAX req/min.
// clientId = Firebase UID when sent by app, or IP as fallback (see rate_limiter.php).
check_rate_limit($clientId);

// ── INPUT GUARD ───────────────────────────────────────────────────────────────
// Sanitizes, validates length, and blocks injection patterns.
// Exits with HTTP 400 + JSON error on reject. Returns cleaned string on pass.
$message = guard_input($message);

// ── TOOL DISPATCH
// calc_personal_plus and all other calculators loaded from tools/calculators.php ─────────────────────────────────────────────────────────────
function dispatch_tool(string $name, array $args): array
{
    switch ($name) {
        case 'calc_personal_standard':    return calc_personal_standard($args);
        case 'calc_personal_plus':        return calc_personal_plus($args);
        case 'calc_real_estate_standard': return calc_real_estate_standard($args);
        case 'calc_deduction_ratio':      return calc_deduction_ratio($args);
        case 'calc_installment_decision': return calc_installment_decision($args);
        case 'calc_commercial_auto':      return calc_commercial_auto($args);
        case 'calc_sale_points':          return calc_sale_points($args);
        case 'calc_savings':              return calc_savings($args);
        case 'calc_savings_protection':   return calc_savings_protection($args);
        default:
            return ['error' => 'أداة غير معروفة: ' . $name];
    }
}

// ── OPENAI TOOL DEFINITIONS ──────────────────────────────────────────────────
$tools = [

    // 1 — القرض الشخصي المختصر
    [
        'type'     => 'function',
        'function' => [
            'name'        => 'calc_personal_standard',
            'description' => 'يحسب أقصى قرض شخصي مبسط بدون التزامات بطاقات أو عقار. استخدمه لأسئلة التمويل الشخصي السريعة عندما لا يذكر المستخدم بطاقات أو قرضاً عقارياً.',
            'parameters'  => [
                'type'       => 'object',
                'properties' => [
                    'salary'      => ['type' => 'number',  'description' => 'الراتب الشهري الصافي بالريال'],
                    'job_status'  => ['type' => 'string',  'enum' => ['حكومي', 'عسكري', 'خاص'], 'description' => 'نوع العمل'],
                    'months'      => ['type' => 'integer', 'description' => 'مدة القرض بالأشهر — افتراضي 60'],
                    'profit_rate' => ['type' => 'number',  'description' => 'نسبة الربح السنوية % — افتراضي 4.9'],
                ],
                'required' => ['salary', 'job_status'],
            ],
        ],
    ],

    // 2 — القرض الشخصي المتقدم
    [
        'type'     => 'function',
        'function' => [
            'name'        => 'calc_personal_plus',
            'description' => 'يحسب أقصى قرض شخصي متقدم مع الأخذ بعين الاعتبار بطاقات الائتمان والقرض العقاري. استخدمه عند ذكر بطاقات أو قرض عقاري قائم.',
            'parameters'  => [
                'type'       => 'object',
                'properties' => [
                    'salary'           => ['type' => 'number',  'description' => 'الراتب الشهري الصافي بالريال'],
                    'job_status'       => ['type' => 'string',  'enum' => ['حكومي', 'عسكري', 'خاص'], 'description' => 'نوع العمل'],
                    'has_real_estate'  => ['type' => 'boolean', 'description' => 'هل يوجد قرض عقاري قائم؟'],
                    'cards1'           => ['type' => 'number',  'description' => 'حد بطاقة الائتمان الأولى بالريال'],
                    'cards2'           => ['type' => 'number',  'description' => 'حد بطاقة الائتمان الثانية بالريال'],
                    'months'           => ['type' => 'integer', 'description' => 'مدة القرض بالأشهر — افتراضي 60'],
                    'profit_rate'      => ['type' => 'number',  'description' => 'نسبة الربح السنوية % — افتراضي 4.9'],
                ],
                'required' => ['salary', 'job_status'],
            ],
        ],
    ],

    // 3 — التمويل العقاري 2 في 1
    [
        'type'     => 'function',
        'function' => [
            'name'        => 'calc_real_estate_standard',
            'description' => 'يحسب أقصى تمويل عقاري للمسكن (2 في 1) مع قرض شخصي قائم. استخدمه لأسئلة شراء البيت أو العقار أو التمويل العقاري.',
            'parameters'  => [
                'type'       => 'object',
                'properties' => [
                    'salary'                    => ['type' => 'number',  'description' => 'الراتب الشهري الصافي بالريال'],
                    'mortgage_years'            => ['type' => 'integer', 'description' => 'مدة القرض العقاري بالسنوات — افتراضي 25'],
                    'profit_rate'               => ['type' => 'number',  'description' => 'نسبة الربح السنوية % — افتراضي 4.05'],
                    'personal_installment'      => ['type' => 'number',  'description' => 'قسط القرض الشخصي الحالي بالريال — 0 إذا لم يوجد'],
                    'remaining_personal_months' => ['type' => 'integer', 'description' => 'الأشهر المتبقية على القرض الشخصي — 0 إذا لم يوجد'],
                    'has_housing_support'       => ['type' => 'boolean', 'description' => 'هل يستفيد من حساب المواطن؟'],
                    'has_etizaz'                => ['type' => 'boolean', 'description' => 'هل يستفيد من برنامج إتزان (160,000 ريال)؟'],
                ],
                'required' => ['salary'],
            ],
        ],
    ],

    // 4 — نسبة الاستقطاع
    [
        'type'     => 'function',
        'function' => [
            'name'        => 'calc_deduction_ratio',
            'description' => 'يعرض نسب الاستقطاع المعتمدة لدى ساما حسب نوع العمل وما إذا كان لديه قرض عقاري — شخصي 33.33% أو 25%، تأجير تمويلي 45%، عقاري 55% أو 65%.',
            'parameters'  => [
                'type'       => 'object',
                'properties' => [
                    'salary'           => ['type' => 'number',  'description' => 'الراتب الشهري بالريال'],
                    'job_status'       => ['type' => 'string',  'enum' => ['حكومي', 'عسكري', 'خاص'], 'description' => 'نوع العمل'],
                    'has_real_estate'  => ['type' => 'boolean', 'description' => 'هل يوجد قرض عقاري قائم؟'],
                ],
                'required' => ['salary', 'job_status'],
            ],
        ],
    ],

    // 5 — متبقي الاستقطاع
    [
        'type'     => 'function',
        'function' => [
            'name'        => 'calc_installment_decision',
            'description' => 'يحسب المتبقي من الاستقطاع بعد الالتزامات الحالية ويحدد إن كان بإمكانه أخذ تمويل إضافي. استخدمه عند سؤال المستخدم: هل يمكنني أخذ قرض إضافي؟ أو عند ذكر التزامات متعددة.',
            'parameters'  => [
                'type'       => 'object',
                'properties' => [
                    'salary'                  => ['type' => 'number',  'description' => 'الراتب الشهري بالريال'],
                    'job_status'              => ['type' => 'string',  'enum' => ['حكومي', 'عسكري', 'خاص'], 'description' => 'نوع العمل'],
                    'personal_deduction'      => ['type' => 'number',  'description' => 'قسط القرض الشخصي الحالي بالريال'],
                    'leasing_deduction'       => ['type' => 'number',  'description' => 'قسط التأجير التمويلي (سيارة) بالريال'],
                    'real_estate_deduction'   => ['type' => 'number',  'description' => 'قسط القرض العقاري بالريال'],
                    'other_deduction'         => ['type' => 'number',  'description' => 'خصومات أخرى بالريال'],
                ],
                'required' => ['salary', 'job_status'],
            ],
        ],
    ],

    // 6 — تمويل المركبات التجاري
    [
        'type'     => 'function',
        'function' => [
            'name'        => 'calc_commercial_auto',
            'description' => 'يحسب قسط تمويل سيارة ومدى الموافقة بناءً على الراتب وسعر السيارة. استخدمه لأسئلة تمويل المركبات أو شراء سيارة بالتقسيط.',
            'parameters'  => [
                'type'       => 'object',
                'properties' => [
                    'salary'               => ['type' => 'number',  'description' => 'الراتب الشهري بالريال'],
                    'car_price'            => ['type' => 'number',  'description' => 'سعر السيارة بالريال'],
                    'job_status'           => ['type' => 'string',  'enum' => ['حكومي', 'عسكري', 'خاص'], 'description' => 'نوع العمل'],
                    'months'               => ['type' => 'integer', 'description' => 'مدة التمويل بالأشهر — افتراضي 60'],
                    'profit_rate'          => ['type' => 'number',  'description' => 'نسبة الربح السنوية % — افتراضي 4.7'],
                    'down_payment_pct'     => ['type' => 'number',  'description' => 'نسبة الدفعة الأولى % — افتراضي 0'],
                    'last_payment_pct'     => ['type' => 'number',  'description' => 'نسبة الدفعة الأخيرة % — افتراضي 40'],
                    'existing_deductions'  => ['type' => 'number',  'description' => 'إجمالي الالتزامات الشهرية الحالية بالريال'],
                    'has_real_estate'      => ['type' => 'boolean', 'description' => 'هل يوجد قرض عقاري قائم؟'],
                ],
                'required' => ['salary', 'car_price'],
            ],
        ],
    ],

    // 7 — تمويل نقاط البيع
    [
        'type'     => 'function',
        'function' => [
            'name'        => 'calc_sale_points',
            'description' => 'يحسب تمويل نقاط البيع للمنشآت التجارية. استخدمه لأصحاب المتاجر أو الأعمال التجارية الراغبين في تمويل عبر نقاط البيع.',
            'parameters'  => [
                'type'       => 'object',
                'properties' => [
                    'monthly_pos'  => ['type' => 'number',  'description' => 'متوسط المبيعات الشهرية عبر نقاط البيع بالريال'],
                    'annual_sales' => ['type' => 'number',  'description' => 'المبيعات السنوية الإجمالية بالريال'],
                    'term_months'  => ['type' => 'integer', 'description' => 'مدة التمويل بالأشهر — افتراضي 60'],
                    'profit_rate'  => ['type' => 'number',  'description' => 'نسبة الربح السنوية % — افتراضي 8'],
                    'entity_age'   => ['type' => 'string',  'enum' => ['أقل من سنة', 'سنة فأكثر'], 'description' => 'عمر المنشأة'],
                    'pos_age'      => ['type' => 'string',  'enum' => ['أقل من سنة', 'سنة فأكثر'], 'description' => 'عمر نقطة البيع'],
                ],
                'required' => ['monthly_pos'],
            ],
        ],
    ],

    // 8 — حساب العائد على الودائع
    [
        'type'     => 'function',
        'function' => [
            'name'        => 'calc_savings',
            'description' => 'يحسب العائد على الودائع البنكية (خيرات). استخدمه لأسئلة الإيداع أو العائد أو الودائع لأجل. الحد الأدنى 100,000 ريال.',
            'parameters'  => [
                'type'       => 'object',
                'properties' => [
                    'amount' => ['type' => 'number', 'description' => 'مبلغ الإيداع بالريال — الحد الأدنى 100,000'],
                    'period' => [
                        'type'        => 'string',
                        'enum'        => ['أسبوعان', 'ثلاثة أسابيع', 'شهر', 'شهران', 'ثلاثة أشهر', 'ستة أشهر', 'تسعة أشهر', 'سنة'],
                        'description' => 'مدة الوديعة',
                    ],
                ],
                'required' => ['amount', 'period'],
            ],
        ],
    ],

    // 9 — حماية الادخار
    [
        'type'     => 'function',
        'function' => [
            'name'        => 'calc_savings_protection',
            'description' => 'يحسب قيمة برنامج حماية الادخار (تأمين + استثمار) وعائده السنوي. استخدمه لأسئلة الادخار مع التأمين أو التخطيط المالي طويل الأمد.',
            'parameters'  => [
                'type'       => 'object',
                'properties' => [
                    'amount'       => ['type' => 'number',  'description' => 'مبلغ الادخار الأولي بالريال'],
                    'years'        => ['type' => 'integer', 'description' => 'عدد سنوات البرنامج — افتراضي 3'],
                    'invest_rate'  => ['type' => 'number',  'description' => 'نسبة العائد الاستثماري السنوية % — افتراضي 8'],
                ],
                'required' => ['amount'],
            ],
        ],
    ],

];

// ── SYSTEM PROMPT ─────────────────────────────────────────────────────────────
$systemPrompt = <<<'PROMPT'
أنت مساعد نِسَب المالي الذكي، مستشار مالي سعودي متخصص ومحترف.
منصة نِسَب أسسها عبدالله المالكي، خبير مصرفي سعودي بخبرة 19 عامًا. تخدم الموظفين والعملاء في فهم التمويلات، الاستقطاعات، والخيارات المالية بدقة وسهولة.

## هويتك
- اسمك: مساعد نِسَب
- جنسيتك: مستشار مالي سعودي محترف
- طابعك: واثق، دقيق، مباشر، شخصي، يتحدث كما يتحدث الخبير لا كما يقرأ روبوت

## أسلوب الرد
- العربية الفصحى المبسطة الواضحة المفهومة. تخدم المصطلحات السعودية الشائعة عند الحاجة (استقطاع، بنك، تمويل).
- اختصر عند السؤال السريع، وفصّل عند الحاجة للتفصيل.
- لا تبدأ كل رد ب "بناءً على" أو "بالتأكيد" أو "بكل سرور" — انتقل مباشرة للمعلومة أو الحساب.
- لا تكرّر التنبيه في كل رد — أضفه فقط عند النتائج الحسابية المحددة.
- الأرقام بالريال مع فواصل الآلاف.
- كن مبادرًا — إذا رأيت فرصة تفيد المستخدم أفصحها.

## قواعد لا تُخترق
- لا تخترع أرقامًا — استخدم الأدوات دائمًا للحساب.
- لا تقدم استشارات استثمارية أو قانونية ملزمة.
- إذا لم تتوفر معطيات كافية، اسأل سؤالًا واحدًا فقط: الراتب ونوع العمل.
- لا تتحدث عن منافسين أو تقدم توصيات بنوك بعينها.

## الأدوات المتاحة
- calc_personal_standard      — قرض شخصي مبسط (بدون بطاقات أو عقار)
- calc_personal_plus          — قرض شخصي متقدم (مع بطاقات / عقار)
- calc_real_estate_standard   — تمويل عقاري 2 في 1
- calc_deduction_ratio        — عرض نسب الاستقطاع ساما
- calc_installment_decision   — متبقي الاستقطاع بعد الالتزامات
- calc_commercial_auto        — تمويل سيارة
- calc_sale_points            — تمويل نقاط البيع
- calc_savings                — عائد الودائع (خيرات)
- calc_savings_protection     — حماية الادخار

## قواعد اختيار الأداة
- قرض شخصي بدون التزامات → calc_personal_standard
- قرض شخصي مع بطاقات أو عقار → calc_personal_plus
- شراء بيت / تمويل عقاري → calc_real_estate_standard
- سؤال عن نسب ساما → calc_deduction_ratio
- هل أستطيع قرض إضافي؟ → calc_installment_decision
- تمويل سيارة → calc_commercial_auto
- منشأة تجارية / نقاط بيع → calc_sale_points
- إيداع / وديعة → calc_savings
- ادخار مع تأمين → calc_savings_protection
- إذا لم يذكر الراتب: اسأل فقط "كم راتبك الشهري ونوع عملك (حكومي / عسكري / خاص)؟"

## بنية الرد عند استخدام الأدوات
1. النتيجة الرئيسية أولًا (بالريال، بارزة)
2. تفاصيل داعمة مختصرة (قسط، مدة، رسوم)
3. تنبيه لمرة واحدة فقط: "الأرقام تقديرية وتختلف حسب سياسة البنك."

## إذا سُئلت عن نِسَب أو عبدالله المالكي
نِسَب منصة حاسبات مالية ذكية سعودية أسسها عبدالله المالكي، خبير مصرفي سعودي بخبرة 19 عامًا في الخدمات المالية. المنصة تقدم 17 حاسبة تفاعلية للتمويلات والادخار والمنتجات المالية وفق أنظمة ساما.
PROMPT;

// Append page-relevant SAMA knowledge blocks to system prompt
$systemPrompt .= get_relevant_knowledge($context);

// ── BUILD MESSAGES ────────────────────────────────────────────────────────────
$messages = [['role' => 'system', 'content' => $systemPrompt]];

// Inject page context as a silent system hint if present
if ($context) {
    $messages[] = [
        'role'    => 'system',
        'content' => 'الصفحة الحالية للمستخدم: ' . $context,
    ];
}

// Merge persisted session history as prior context (session turns come first)
$sessionHistory = load_session($userId);
if (!empty($sessionHistory)) {
    // session history prepended; request history appended (more recent wins)
    $history = array_merge($sessionHistory, $history);
}

// Keep last 8 turns total (session + fresh request combined) to bound token usage
$history = array_slice($history, -8);
foreach ($history as $turn) {
    if (isset($turn['role'], $turn['content']) &&
        in_array($turn['role'], ['user', 'assistant'], true)) {
        $messages[] = [
            'role'    => $turn['role'],
            'content' => (string) $turn['content'],
        ];
    }
}

// Current user message
$messages[] = ['role' => 'user', 'content' => $message];

// ── OPENAI CALL HELPER ────────────────────────────────────────────────────────
function openai_call(array $payload): ?array
{
    $ch = curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . OPENAI_API_KEY,
        ],
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_CONNECTTIMEOUT => 10,
    ]);
    $result   = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if (!$result || $httpCode !== 200) {
        return null;
    }
    return json_decode($result, true);
}

// ── FIRST OPENAI CALL ─────────────────────────────────────────────────────────
$payload1 = [
    'model'       => 'gpt-4o',
    'messages'    => $messages,
    'tools'       => $tools,
    'tool_choice' => 'auto',
    'max_tokens'  => 700,
    'temperature' => 0.3,
];

$response1 = openai_call($payload1);

if (!$response1) {
    echo json_encode(
        ['reply' => 'عذراً، حدث خطأ مؤقت في الخادم. حاول مرة أخرى.', 'source' => 'error'],
        JSON_UNESCAPED_UNICODE
    );
    exit;
}

$choice1 = $response1['choices'][0] ?? null;

if (!$choice1) {
    echo json_encode(
        ['reply' => 'عذراً، لم أتمكن من معالجة طلبك. حاول مرة أخرى.', 'source' => 'error'],
        JSON_UNESCAPED_UNICODE
    );
    exit;
}

// ── HANDLE TOOL CALL ──────────────────────────────────────────────────────────
if (!empty($choice1['message']['tool_calls'])) {
    $toolCall   = $choice1['message']['tool_calls'][0];
    $funcName   = $toolCall['function']['name']      ?? '';
    $funcArgs   = json_decode($toolCall['function']['arguments'] ?? '{}', true);
    $toolCallId = $toolCall['id'] ?? 'call_0';

    $calcResult = dispatch_tool($funcName, is_array($funcArgs) ? $funcArgs : []);

    // Append assistant tool_call message + tool result to messages
    $messages[] = $choice1['message'];
    $messages[] = [
        'role'         => 'tool',
        'tool_call_id' => $toolCallId,
        'content'      => json_encode($calcResult, JSON_UNESCAPED_UNICODE),
    ];

    // Second call — get final Arabic reply from OpenAI using the calc result
    $payload2 = [
        'model'       => 'gpt-4o',
        'messages'    => $messages,
        'max_tokens'  => 700,
        'temperature' => 0.3,
    ];

    $response2   = openai_call($payload2);
    $finalReply  = $response2['choices'][0]['message']['content']
                   ?? 'عذراً، حدث خطأ في معالجة نتيجة الحساب.';

    // Persist this turn (user message + assistant reply)
    save_session($userId, [
        ['role' => 'user',      'content' => $message],
        ['role' => 'assistant', 'content' => $finalReply],
    ]);

    // Log: tool-call path
    log_request(
        $clientId, $context, $funcName,
        mb_strlen($message, 'UTF-8'), mb_strlen($finalReply, 'UTF-8'),
        $startTime
    );

    echo json_encode([
        'reply'       => $finalReply,
        'source'      => 'ai',
        'calc_used'   => $funcName,
        'calc_result' => $calcResult,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ── DIRECT REPLY (no tool needed) ─────────────────────────────────────────────
$finalReply = $choice1['message']['content']
              ?? 'عذراً، لم أستطع الرد. حاول مرة أخرى.';

// Persist this turn (user message + assistant reply)
save_session($userId, [
    ['role' => 'user',      'content' => $message],
    ['role' => 'assistant', 'content' => $finalReply],
]);

// Log: direct reply path (no tool called)
log_request(
    $clientId, $context, null,
    mb_strlen($message, 'UTF-8'), mb_strlen($finalReply, 'UTF-8'),
    $startTime
);

echo json_encode(
    ['reply' => $finalReply, 'source' => 'ai'],
    JSON_UNESCAPED_UNICODE
);
