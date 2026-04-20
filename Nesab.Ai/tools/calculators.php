<?php
/**
 * Nesab AI — Calculator Library
 * Ported from Nesab HTML pages. Called exclusively via dispatch_tool() in chat.php.
 *
 * Functions:
 *   calc_personal_standard      — shakhsi-mukhtasar.html
 *   calc_personal_plus          — shakhsi-plus.html
 *   calc_real_estate_standard   — aqari-aadi.html
 *   calc_deduction_ratio        — nisbat-alistiqtaa.html
 *   calc_installment_decision   — istiqtaa-naam-la.html
 *   calc_commercial_auto        — tajiri-aadi.html (simplified)
 *   calc_sale_points            — niqat-albay.html
 *   calc_savings                — khayrat.html
 *   calc_savings_protection     — himaya-iddikhar.html
 */


// ── 1. calc_personal_standard ─────────────────────────────────────────────────
// Source: shakhsi-mukhtasar.html
// القرض الشخصي المختصر — بدون التزامات بطاقات أو عقار
function calc_personal_standard(array $p): array
{
    $salary     = floatval($p['salary']      ?? 0);
    $jobStatus  = trim($p['job_status']      ?? 'حكومي');
    $months     = max(1, intval($p['months'] ?? 60));
    $profitRate = floatval($p['profit_rate'] ?? 4.9) / 100;

    if ($salary <= 0) {
        return ['error' => 'الراتب يجب أن يكون أكبر من صفر.'];
    }

    // getDedRate() — حكومي/خاص = 33.33%، عسكري = 25%
    $dedRate = ($jobStatus === 'عسكري') ? 0.25 : 0.3333;

    $installment = $salary * $dedRate;
    $totalFin    = $installment * $months;
    $approvalAmt = $totalFin / (1 + ($profitRate * $months) / 12);
    $adminFee    = min($approvalAmt / 200, 2500);
    $tax         = $adminFee * 0.15;
    $totalFees   = $adminFee + $tax;
    $bankProfit  = ($approvalAmt * $profitRate * $months) / 12;
    $netFinal    = $approvalAmt - $totalFees;

    return [
        'max_installment'    => round($installment, 2),
        'total_financing'    => round($totalFin, 2),
        'approval_amount'    => round($approvalAmt, 2),
        'admin_fee'          => round($adminFee, 2),
        'tax_15pct'          => round($tax, 2),
        'total_fees'         => round($totalFees, 2),
        'bank_profit'        => round($bankProfit, 2),
        'net_after_fees'     => round($netFinal, 2),
        'deduction_rate_pct' => round($dedRate * 100, 2),
        'months'             => $months,
        'status'             => 'within_limit',
    ];
}


// ── 2. calc_personal_plus ─────────────────────────────────────────────────────
// Source: shakhsi-plus.html
// القرض الشخصي المتقدم — مع بطاقات ائتمان وخيار القرض العقاري
function calc_personal_plus(array $p): array
{
    $salary     = floatval($p['salary']         ?? 0);
    $jobStatus  = trim($p['job_status']         ?? 'حكومي');
    $hasRE      = boolval($p['has_real_estate'] ?? false);
    $cards1     = floatval($p['cards1']         ?? 0);
    $cards2     = floatval($p['cards2']         ?? 0);
    $months     = max(1, intval($p['months']    ?? 60));
    $profitRate = floatval($p['profit_rate']    ?? 4.9) / 100;

    if ($salary <= 0) {
        return ['error' => 'الراتب يجب أن يكون أكبر من صفر.'];
    }

    // getDedRate() — نسبة الاستقطاع حسب ساما
    if (!$hasRE) {
        $dedRate = ($jobStatus === 'عسكري') ? 0.25 : 0.3333;
    } else {
        if ($jobStatus === 'عسكري')   { $dedRate = 0.55; }
        elseif ($salary < 15000)      { $dedRate = 0.55; }
        else                          { $dedRate = 0.65; }
    }

    $installment = $salary * $dedRate - $cards1 * 0.05 - $cards2 * 0.05;

    if ($installment <= 0) {
        return ['error' => 'الراتب لا يكفي بعد خصم الالتزامات الحالية.'];
    }

    $totalFin    = $installment * $months;
    $approvalAmt = $totalFin / (1 + ($profitRate * $months) / 12);
    $adminFee    = min($approvalAmt / 200, 2500);
    $tax         = $adminFee * 0.15;
    $totalFees   = $adminFee + $tax;
    $bankProfit  = ($approvalAmt * $profitRate * $months) / 12;
    $netFinal    = $approvalAmt - $totalFees;

    return [
        'max_installment'    => round($installment, 2),
        'total_financing'    => round($totalFin, 2),
        'approval_amount'    => round($approvalAmt, 2),
        'admin_fee'          => round($adminFee, 2),
        'tax_15pct'          => round($tax, 2),
        'total_fees'         => round($totalFees, 2),
        'bank_profit'        => round($bankProfit, 2),
        'net_after_fees'     => round($netFinal, 2),
        'deduction_rate_pct' => round($dedRate * 100, 2),
        'months'             => $months,
        'status'             => 'within_limit',
    ];
}


// ── 3. calc_real_estate_standard ─────────────────────────────────────────────
// Source: aqari-aadi.html
// التمويل العقاري 2 في 1 — مع قرض شخصي قائم
function calc_real_estate_standard(array $p): array
{
    $salary              = floatval($p['salary']                    ?? 0);
    $mortgageYears       = max(1, intval($p['mortgage_years']       ?? 25));
    $profitRate          = floatval($p['profit_rate']               ?? 4.05) / 100;
    $personalInstall     = floatval($p['personal_installment']      ?? 0);
    $remainingPersonal   = intval($p['remaining_personal_months']   ?? 0);
    $hasHousingSupport   = boolval($p['has_housing_support']        ?? false);
    $hasEtizaz           = boolval($p['has_etizaz']                 ?? false);

    if ($salary <= 0) {
        return ['error' => 'الراتب يجب أن يكون أكبر من صفر.'];
    }

    $totalMonths      = $mortgageYears * 12;
    $personalPct      = $salary > 0 ? $personalInstall / $salary : 0;
    $dedRate          = $salary >= 15000 ? 0.65 : 0.55;
    $monthlyDed       = $dedRate * $salary;
    $duringInst       = $salary * ($dedRate - $personalPct);
    $duringInstCapped = min($duringInst, $monthlyDed);
    $afterInst        = $monthlyDed;

    $remMonths       = max(0, $totalMonths - $remainingPersonal);
    $totalDuring     = $duringInstCapped * $remainingPersonal;
    $totalAfter      = $afterInst * $remMonths;
    $totalWithProfit = $totalDuring + $totalAfter;
    $maxAmount       = $totalWithProfit > 0
                       ? $totalWithProfit / (1 + ($profitRate * $mortgageYears))
                       : 0;
    $totalProfit     = $totalWithProfit - $maxAmount;

    // دعم حساب المواطن
    $housingVal = 0;
    if ($hasHousingSupport) {
        $housingVal = $salary <= 10000 ? 150000 : 100000;
    }
    $etizazVal = $hasEtizaz ? 160000 : 0;
    $grandTotal = $maxAmount + $housingVal + $etizazVal;
    $adminFee   = 5750; // رسوم إدارية ثابتة للتمويل العقاري

    return [
        'max_mortgage_amount'  => round($maxAmount, 2),
        'total_with_profit'    => round($totalWithProfit, 2),
        'total_profit'         => round($totalProfit, 2),
        'installment_during'   => round($duringInstCapped, 2),
        'installment_after'    => round($afterInst, 2),
        'remaining_months'     => $remainingPersonal,
        'after_months'         => $remMonths,
        'housing_support'      => $housingVal,
        'etizaz_support'       => $etizazVal,
        'grand_total'          => round($grandTotal, 2),
        'admin_fee'            => $adminFee,
        'mortgage_years'       => $mortgageYears,
        'deduction_rate_pct'   => round($dedRate * 100, 2),
    ];
}


// ── 4. calc_deduction_ratio ──────────────────────────────────────────────────
// Source: nisbat-alistiqtaa.html
// نسبة الاستقطاع المتاحة — حسب نوع العمل وما إذا كان لديه قرض عقاري
function calc_deduction_ratio(array $p): array
{
    $salary    = floatval($p['salary']     ?? 0);
    $jobStatus = trim($p['job_status']     ?? 'حكومي');
    $hasRE     = boolval($p['has_real_estate'] ?? false);

    if ($salary <= 0) {
        return ['error' => 'الراتب يجب أن يكون أكبر من صفر.'];
    }

    // نسب ساما 2025
    $personalRate = ($jobStatus === 'عسكري') ? 0.25 : 0.3333;
    $leasingRate  = 0.45;

    if ($jobStatus === 'عسكري') {
        $reRate = 0.55;
    } elseif ($salary < 15000) {
        $reRate = 0.55;
    } else {
        $reRate = 0.65;
    }

    $effectiveRate = $hasRE ? $reRate : $personalRate;

    return [
        'salary'                    => $salary,
        'personal_rate_pct'         => round($personalRate * 100, 2),
        'personal_max_sar'          => round($salary * $personalRate, 2),
        'leasing_rate_pct'          => round($leasingRate * 100, 2),
        'leasing_max_sar'           => round($salary * $leasingRate, 2),
        'real_estate_rate_pct'      => round($reRate * 100, 2),
        'real_estate_max_sar'       => round($salary * $reRate, 2),
        'effective_rate_pct'        => round($effectiveRate * 100, 2),
        'effective_max_sar'         => round($salary * $effectiveRate, 2),
        'job_status'                => $jobStatus,
        'note'                      => 'نسب ساما المعتمدة 2025',
    ];
}


// ── 5. calc_installment_decision ──────────────────────────────────────────────
// Source: istiqtaa-naam-la.html
// متبقي الاستقطاع — كم يتبقى بعد الالتزامات الحالية لكل نوع تمويل
function calc_installment_decision(array $p): array
{
    $salary        = floatval($p['salary']              ?? 0);
    $jobStatus     = trim($p['job_status']              ?? 'حكومي');
    $personalDed   = floatval($p['personal_deduction']  ?? 0);
    $leasingDed    = floatval($p['leasing_deduction']   ?? 0);
    $realEstateDed = floatval($p['real_estate_deduction'] ?? 0);
    $otherDed      = floatval($p['other_deduction']     ?? 0);

    if ($salary <= 0) {
        return ['error' => 'الراتب يجب أن يكون أكبر من صفر.'];
    }

    $totalDed  = $personalDed + $leasingDed + $realEstateDed + $otherDed;
    $actualPct = $salary > 0 ? $totalDed / $salary : 0;

    $pct33 = ($jobStatus === 'عسكري') ? 0.25 : 0.3333;
    $pct45 = 0.45;
    $pctRE = $salary < 15000 ? 0.55 : 0.65;

    $availPersonal = max(0, $salary * $pct33 - $totalDed);
    $availLeasing  = max(0, $salary * $pct45 - $totalDed);
    $availRE       = max(0, $salary * $pctRE  - $totalDed);

    $status = $actualPct > $pct33 ? 'exceeded' : 'within_limit';

    return [
        'salary'                    => $salary,
        'total_deductions'          => round($totalDed, 2),
        'actual_deduction_pct'      => round($actualPct * 100, 2),
        'available_for_personal'    => round($availPersonal, 2),
        'available_for_leasing'     => round($availLeasing, 2),
        'available_for_real_estate' => round($availRE, 2),
        'personal_rate_pct'         => round($pct33 * 100, 2),
        'leasing_rate_pct'          => round($pct45 * 100, 2),
        'real_estate_rate_pct'      => round($pctRE * 100, 2),
        'status'                    => $status,
    ];
}


// ── 6. calc_commercial_auto ──────────────────────────────────────────────────
// Source: tajiri-aadi.html (simplified — core calcMonthly logic preserved)
// تمويل المركبات التجاري — حساب القسط والموافقة
function calc_commercial_auto(array $p): array
{
    $salary           = floatval($p['salary']              ?? 0);
    $carPrice         = floatval($p['car_price']           ?? 0);
    $months           = max(12, intval($p['months']        ?? 60));
    $profitRate       = floatval($p['profit_rate']         ?? 4.7) / 100;
    $downPayPct       = floatval($p['down_payment_pct']    ?? 0) / 100;
    $lastPayPct       = floatval($p['last_payment_pct']    ?? 40) / 100;
    $existingDed      = floatval($p['existing_deductions'] ?? 0);
    $jobStatus        = trim($p['job_status']              ?? 'حكومي');
    $hasRealEstate    = boolval($p['has_real_estate']      ?? false);

    if ($salary <= 0 || $carPrice <= 0) {
        return ['error' => 'الراتب وسعر المركبة مطلوبان.'];
    }

    // نسبة الاستقطاع المتاحة للتأجير التمويلي 45%
    // إذا كان لديه عقار: 65% أو 70% للراتب 15k+
    if ($hasRealEstate) {
        $dedRate = $salary < 15000 ? 0.65 : 0.70;
    } else {
        $dedRate = 0.45;
    }

    $available    = $salary * $dedRate - $existingDed;
    $downPay      = $carPrice * $downPayPct;
    $lastPay      = $carPrice * $lastPayPct;
    // insurance estimate (simplified)
    $insurance    = 0.0545 * $carPrice * ($months === 60 ? 3.7087 : ($months / 12) * 0.74174);
    $financed     = $carPrice - $downPay;
    $monthly      = ceil(($financed + $financed * $profitRate * ($months / 12) + $insurance - $lastPay) / $months);
    $total        = $monthly * $months + $lastPay + $downPay;
    $actualPct    = $salary > 0 ? ($existingDed + $monthly) / $salary : 0;
    $approved     = $monthly <= $available && $salary >= 4000;

    return [
        'monthly_installment'   => $monthly,
        'financed_amount'       => round($financed, 2),
        'down_payment'          => round($downPay, 2),
        'last_payment'          => round($lastPay, 2),
        'insurance_estimate'    => round($insurance, 2),
        'total_cost'            => round($total, 2),
        'available_installment' => round(max(0, $available), 2),
        'actual_deduction_pct'  => round($actualPct * 100, 2),
        'deduction_rate_pct'    => round($dedRate * 100, 2),
        'months'                => $months,
        'approved'              => $approved,
        'status'                => $approved ? 'approved' : 'not_approved',
    ];
}


// ── 7. calc_sale_points ──────────────────────────────────────────────────────
// Source: niqat-albay.html
// تمويل نقاط البيع للمنشآت التجارية
function calc_sale_points(array $p): array
{
    $monthlyPOS  = floatval($p['monthly_pos']   ?? 0);
    $annualSales = floatval($p['annual_sales']  ?? 0);
    $termMonths  = max(12, intval($p['term_months']  ?? 60));
    $profitRate  = floatval($p['profit_rate']   ?? 8) / 100;
    $entityAge   = trim($p['entity_age']        ?? 'سنة فأكثر');
    $posAge      = trim($p['pos_age']           ?? 'سنة فأكثر');

    if ($monthlyPOS <= 0) {
        return ['error' => 'متوسط المبيعات الشهرية عبر نقاط البيع مطلوب.'];
    }

    // شروط الأهلية
    $reasons = [];
    if ($annualSales > 0 && $annualSales < 400000) {
        $reasons[] = 'المبيعات السنوية أقل من 400,000 ريال';
    }
    if ($entityAge === 'أقل من سنة') {
        $reasons[] = 'عمر المنشأة أقل من سنة';
    }
    if ($posAge === 'أقل من سنة') {
        $reasons[] = 'عمر نقطة البيع أقل من سنة';
    }
    if ($monthlyPOS < 33333.33) {
        $reasons[] = 'متوسط نقاط البيع أقل من 33,333 ريال شهرياً';
    }

    $approved     = empty($reasons);
    $finAmount    = $monthlyPOS * 6;
    $termYears    = $termMonths / 12;
    $totalProfit  = $finAmount * $profitRate * $termYears;
    $totalAmount  = $finAmount + $totalProfit;
    $installment  = $totalAmount / $termMonths;
    $adminFee     = min($finAmount * 0.05, 2500) * 1.15; // شامل 15% ضريبة

    return [
        'approved'          => $approved,
        'rejection_reasons' => $reasons,
        'financing_amount'  => round($finAmount, 2),
        'monthly_installment' => round($installment, 2),
        'total_profit'      => round($totalProfit, 2),
        'total_amount'      => round($totalAmount, 2),
        'admin_fee'         => round($adminFee, 2),
        'term_months'       => $termMonths,
        'profit_rate_pct'   => round($profitRate * 100, 2),
        'status'            => $approved ? 'approved' : 'not_approved',
    ];
}


// ── 8. calc_savings ──────────────────────────────────────────────────────────
// Source: khayrat.html
// حساب عائد الودائع البنكية (خيرات)
function calc_savings(array $p): array
{
    $amount = floatval($p['amount'] ?? 0);
    $period = trim($p['period']    ?? 'شهر');

    if ($amount <= 0) {
        return ['error' => 'مبلغ الإيداع مطلوب.'];
    }
    if ($amount < 100000) {
        return ['error' => 'الحد الأدنى للإيداع 100,000 ريال.'];
    }

    // RATES من khayrat.html — نسب البنوك السعودية المرجعية
    $rates = [
        'أسبوعان'         => ['rate' => 0.0395, 'days' => 14],
        'ثلاثة أسابيع'   => ['rate' => 0.0405, 'days' => 21],
        'شهر'             => ['rate' => 0.0435, 'days' => 30],
        'شهران'           => ['rate' => 0.0448, 'days' => 60],
        'ثلاثة أشهر'     => ['rate' => 0.0460, 'days' => 90],
        'ستة أشهر'        => ['rate' => 0.0465, 'days' => 180],
        'تسعة أشهر'      => ['rate' => 0.0455, 'days' => 270],
        'سنة'             => ['rate' => 0.0445, 'days' => 360],
    ];

    if (!isset($rates[$period])) {
        $keys = implode(' | ', array_keys($rates));
        return ['error' => "الفترة غير صحيحة. الخيارات المتاحة: $keys"];
    }

    $r      = $rates[$period];
    $profit = ($amount * $r['rate'] * $r['days']) / 360;
    $total  = $amount + $profit;

    return [
        'amount'       => $amount,
        'period'       => $period,
        'days'         => $r['days'],
        'rate_pct'     => round($r['rate'] * 100, 4),
        'profit'       => round($profit, 2),
        'total'        => round($total, 2),
        'status'       => 'calculated',
    ];
}


// ── 9. calc_savings_protection ───────────────────────────────────────────────
// Source: himaya-iddikhar.html
// حماية الادخار (تأمين + استثمار) — محاكاة سنوية
function calc_savings_protection(array $p): array
{
    $amount     = floatval($p['amount']       ?? 0);
    $years      = max(1, min(30, intval($p['years'] ?? 3)));
    $investRate = floatval($p['invest_rate']  ?? 8) / 100;

    if ($amount <= 0) {
        return ['error' => 'مبلغ الادخار مطلوب.'];
    }

    // حساب التغطية التأمينية
    $coverage = min(max($amount * 0.1, 15000), 250000);

    // رسوم ثابتة سنوية
    $partFee   = ($amount * 55) / 1000; // رسم المشاركة - السنة الأولى فقط
    $adminFeeY = 420;
    $riskFeeY  = 420;

    $rows    = [];
    $prevVal = $amount;

    for ($y = 1; $y <= $years; $y++) {
        $pf      = ($y === 1) ? $partFee : 0;
        $base    = $prevVal - $pf - $adminFeeY - $riskFeeY;
        $income  = $base * $investRate;
        $invFee  = ($base + $income) * (75 / 10000); // 0.75% رسم إدارة الاستثمار
        $cashVal = $base + $income - $invFee;

        $rows[] = [
            'year'      => $y,
            'income'    => round($income, 2),
            'cash_val'  => round($cashVal, 2),
            'death_val' => round($cashVal + $coverage, 2),
            'part_fee'  => round($pf, 2),
            'admin_fee' => $adminFeeY,
            'risk_fee'  => $riskFeeY,
            'inv_fee'   => round($invFee, 2),
        ];

        $prevVal = $cashVal;
    }

    $last = end($rows);

    return [
        'initial_amount'     => $amount,
        'years'              => $years,
        'invest_rate_pct'    => round($investRate * 100, 2),
        'coverage_amount'    => $coverage,
        'final_cash_value'   => $last['cash_val'],
        'final_death_value'  => $last['death_val'],
        'year_by_year'       => $rows,
        'status'             => 'calculated',
    ];
}
