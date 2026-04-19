document.addEventListener("DOMContentLoaded", function () {
  const numberFormatter = new Intl.NumberFormat("ar-SA");
  const gregorianFormatter = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  });
  const hijriMonths = [
    "محرم",
    "صفر",
    "ربيع الأول",
    "ربيع الآخر",
    "جمادى الأولى",
    "جمادى الآخرة",
    "رجب",
    "شعبان",
    "رمضان",
    "شوال",
    "ذو القعدة",
    "ذو الحجة"
  ];
  const islamicEpoch = 1948440;

  function renderResult(container, variant, title, mutedText) {
    if (!container) {
      return;
    }

    const muted = mutedText ? '<p class="nesab-result-muted">' + mutedText + "</p>" : "";
    container.innerHTML =
      '<div class="nesab-result-card nesab-result-card--' + variant + '">' +
      '<p class="nesab-result-title">' + title + "</p>" +
      muted +
      "</div>";
  }

  function parseIsoDate(value) {
    if (!value) {
      return null;
    }

    const parts = value.split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) {
      return null;
    }

    return {
      year: parts[0],
      month: parts[1],
      day: parts[2]
    };
  }

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function gregorianToJdn(year, month, day) {
    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;
    return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  }

  function jdnToGregorian(jdn) {
    const a = jdn + 32044;
    const b = Math.floor((4 * a + 3) / 146097);
    const c = a - Math.floor((146097 * b) / 4);
    const d = Math.floor((4 * c + 3) / 1461);
    const e = c - Math.floor((1461 * d) / 4);
    const m = Math.floor((5 * e + 2) / 153);
    return {
      day: e - Math.floor((153 * m + 2) / 5) + 1,
      month: m + 3 - 12 * Math.floor(m / 10),
      year: 100 * b + d - 4800 + Math.floor(m / 10)
    };
  }

  function islamicToJdn(year, month, day) {
    return day + Math.ceil(29.5 * (month - 1)) + (year - 1) * 354 + Math.floor((3 + 11 * year) / 30) + islamicEpoch - 1;
  }

  function jdnToIslamic(jdn) {
    const year = Math.floor((30 * (jdn - islamicEpoch) + 10646) / 10631);
    const month = Math.min(12, Math.ceil((jdn - 29 - islamicToJdn(year, 1, 1)) / 29.5) + 1);
    const day = jdn - islamicToJdn(year, month, 1) + 1;

    return {
      year: year,
      month: month,
      day: day
    };
  }

  function formatHijri(dateParts) {
    return numberFormatter.format(dateParts.day) + " " + hijriMonths[dateParts.month - 1] + " " + numberFormatter.format(dateParts.year) + " هـ";
  }

  function formatGregorian(dateParts) {
    const date = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day));
    return gregorianFormatter.format(date);
  }

  function setPanel(activeId) {
    const buttons = Array.from(document.querySelectorAll(".fee-tab-btn"));
    const panels = Array.from(document.querySelectorAll(".fee-tab-panel"));

    buttons.forEach(function (button) {
      const isActive = button.dataset.tab === activeId;
      button.classList.toggle("active", isActive);
      button.classList.toggle("btn-ghost", !isActive);
      button.setAttribute("aria-selected", String(isActive));
    });

    panels.forEach(function (panel) {
      panel.classList.toggle("hidden", panel.id !== activeId);
    });
  }

  Array.from(document.querySelectorAll(".fee-tab-btn")).forEach(function (button) {
    button.addEventListener("click", function () {
      setPanel(button.dataset.tab);
    });
  });

  setPanel("tab-basic");

  const ageForm = document.getElementById("age-calc-form");
  if (ageForm) {
    ageForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const result = document.getElementById("age-result");
      const birthDate = parseIsoDate(document.getElementById("birth-date").value);

      if (!birthDate) {
        renderResult(result, "red", "أدخل تاريخ ميلاد صحيح.", "");
        return;
      }

      const todayDate = new Date();
      const today = {
        year: todayDate.getFullYear(),
        month: todayDate.getMonth() + 1,
        day: todayDate.getDate()
      };

      if (
        birthDate.year > today.year ||
        (birthDate.year === today.year && birthDate.month > today.month) ||
        (birthDate.year === today.year && birthDate.month === today.month && birthDate.day > today.day)
      ) {
        renderResult(result, "red", "تاريخ الميلاد لا يمكن أن يكون في المستقبل.", "");
        return;
      }

      let years = today.year - birthDate.year;
      let months = today.month - birthDate.month;
      let days = today.day - birthDate.day;

      if (days < 0) {
        months -= 1;
        const previousMonth = today.month === 1 ? 12 : today.month - 1;
        const previousYear = today.month === 1 ? today.year - 1 : today.year;
        days += daysInMonth(previousYear, previousMonth);
      }

      if (months < 0) {
        years -= 1;
        months += 12;
      }

      renderResult(
        result,
        "emerald",
        numberFormatter.format(years) + " سنة، " + numberFormatter.format(months) + " شهر، " + numberFormatter.format(days) + " يوم",
        "العمر محسوب حتى تاريخ اليوم."
      );
    });
  }

  const directionSelect = document.getElementById("convert-direction");
  const gregorianFields = document.getElementById("gregorian-fields");
  const hijriFields = document.getElementById("hijri-fields");
  const gregorianInput = document.getElementById("convert-date");
  const hijriDay = document.getElementById("hijri-day");
  const hijriMonth = document.getElementById("hijri-month");
  const hijriYear = document.getElementById("hijri-year");

  function syncConvertFields() {
    if (!directionSelect || !gregorianFields || !hijriFields || !gregorianInput || !hijriDay || !hijriMonth || !hijriYear) {
      return;
    }

    const toHijri = directionSelect.value === "to-hijri";
    gregorianFields.classList.toggle("hidden", !toHijri);
    hijriFields.classList.toggle("hidden", toHijri);
    hijriFields.setAttribute("aria-hidden", String(toHijri));
    gregorianInput.required = toHijri;
    hijriDay.required = !toHijri;
    hijriMonth.required = !toHijri;
    hijriYear.required = !toHijri;
  }

  if (directionSelect) {
    directionSelect.addEventListener("change", syncConvertFields);
    syncConvertFields();
  }

  const dateForm = document.getElementById("date-convert-form");
  if (dateForm) {
    dateForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const result = document.getElementById("date-result");

      if (directionSelect && directionSelect.value === "to-hijri") {
        const gregorian = parseIsoDate(gregorianInput.value);
        if (!gregorian) {
          renderResult(result, "red", "أدخل تاريخاً ميلادياً صحيحاً.", "");
          return;
        }

        const hijri = jdnToIslamic(gregorianToJdn(gregorian.year, gregorian.month, gregorian.day));
        renderResult(
          result,
          "blue",
          formatHijri(hijri),
          "التحويل تم باستخدام تقويم هجري حسابي تقريبي لأغراض الاسترشاد."
        );
        return;
      }

      const year = Number(hijriYear.value);
      const month = Number(hijriMonth.value);
      const day = Number(hijriDay.value);

      if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 30) {
        renderResult(result, "red", "أدخل تاريخاً هجرياً صحيحاً بالأرقام.", "");
        return;
      }

      const gregorian = jdnToGregorian(islamicToJdn(year, month, day));
      renderResult(
        result,
        "blue",
        formatGregorian(gregorian),
        "التحويل تم باستخدام تقويم هجري حسابي تقريبي لأغراض الاسترشاد."
      );
    });
  }

  const deductForm = document.getElementById("deduct-calc-form");
  if (deductForm) {
    deductForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const result = document.getElementById("deduct-result");
      const salary = Number(document.getElementById("salary-input").value);
      const installment = Number(document.getElementById("installment-input").value);

      if (!salary || salary <= 0 || !installment || installment < 0) {
        renderResult(result, "red", "أدخل أرقاماً صحيحة للراتب والقسط.", "");
        return;
      }

      const percentage = (installment / salary) * 100;
      const remaining = salary - installment;
      let statusText = "النسبة ضمن نطاق مريح نسبياً.";

      if (percentage > 45) {
        statusText = "النسبة مرتفعة وتحتاج مراجعة قبل الالتزام.";
      } else if (percentage > 33) {
        statusText = "النسبة متوسطة وتحتاج موازنة مع بقية الالتزامات.";
      }

      renderResult(
        result,
        "amber",
        "نسبة الاستقطاع: " + numberFormatter.format(Number(percentage.toFixed(2))) + "%",
        "المتبقي من الراتب: " + numberFormatter.format(Number(remaining.toFixed(2))) + " ريال. " + statusText
      );
    });
  }
});
