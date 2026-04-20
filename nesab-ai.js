/* ═══════════════════════════════════════════
   Nesab AI — المستشار الائتماني v2.0
   Enhanced with Draggable Widget
   ═══════════════════════════════════════════ */

(function () {
  "use strict";

  const ICON_SRC = "./technical-support.png";
  const STORAGE_KEY = "nesab_ai_position";
  const HAS_SAVED_POSITION = "nesab_ai_has_saved_position";
  // Phase 8 — in-session conversation memory (sent to chat.php as history param)
  let conversationHistory = [];

  // ─── BUILD HTML ───
  let html = '<div class="nesab-ai-widget" id="nesabAiWidget">';
  html += '<div class="nesab-ai-panel" id="nesabAiPanel">';
  html +=
    '<div class="nesab-ai-hdr" id="nesabAiDragHandle"><span>Nesab AI</span><button onclick="NesabAI.toggle()" aria-label="إغلاق">✕</button></div>';
  html +=
    '<div class="nesab-ai-chat" id="nesabAiChat"><div class="nesab-ai-msg"><span class="nesab-ai-name">نسب:</span> يــاهلا .. انا مستشارك الائتماني .. تفضل اذا عندك استفسار او سؤال</div></div>';
  html +=
    '<div class="nesab-ai-inp"><input type="text" id="nesabAiQ" placeholder="اسالني..." onkeydown="if(event.key===\'Enter\')NesabAI.ask()"><button onclick="NesabAI.ask()" aria-label="إرسال">ارسال</button></div>';
  html += "</div>";
  html +=
    '<button class="nesab-ai-fab" id="nesabAiFab" aria-label="فتح المستشار الائتماني"><img src="' +
    ICON_SRC +
    '" alt="Nesab AI" draggable="false"></button>';
  html += "</div>";

  // ─── BUILD STYLES ───
  const css = document.createElement("style");
  css.textContent = `
    .nesab-ai-widget {
      position: fixed;
      right: 20px;
      bottom: 20px;
      left: auto;
      top: auto;
      z-index: 9999;
      user-select: none;
      direction: rtl;
      transform: translateZ(0);
      backface-visibility: hidden;
    }

    .nesab-ai-widget.repositioned {
      right: auto;
      bottom: auto;
    }

    .nesab-ai-fab {
      position: absolute;
      bottom: 20px;
      right: 20px;
      width: 80px; /* تقليل الحجم قليلاً ليكون أكثر أناقة */
      height: 80px;
      border-radius: 50%;
      /* تدرج شبكي هادئ يشبه زرار "التالي" */
      background: radial-gradient(circle at 10% 10%, rgba(131, 144, 250, 0.15) 0%, transparent 50%),
                  radial-gradient(circle at 90% 90%, rgba(253, 230, 138, 0.1) 0%, transparent 50%),
                  #12141d;
      border: 1px solid #2d313e;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      cursor: grab;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 70%;
      touch-action: none;
    }

    .nesab-ai-fab:hover {
      transform: scale(1.05) translateY(-5px);
      border-color: #fde68a; /* لمسة ذهبية عند التمرير */
      opacity: 100%;
      box-shadow: 5px 9px 30px white;
    }

    .nesab-ai-fab img {
      width: 60%;
      height: 60%;
      object-fit: contain;
      pointer-events: none;
      filter: drop-shadow(0 0 5px rgba(253, 230, 138, 0.2));
    }

    .nesab-ai-panel {
      position: absolute;
      bottom: 110px;
      right: 0;
      width: 320px;
      max-width: 90vw;
      background: #12141d; /* خلفية داكنة فخمة */
      border-radius: 20px;
      border: 1px solid #2d313e;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8),
                  0 0 20px rgba(93, 95, 239, 0.05);
      display: none;
      flex-direction: column;
      overflow: hidden;
      pointer-events: auto;
      max-height: 70vh;
    }

    .nesab-ai-panel.open {
      display: flex;
      animation: slideUp 0.4s ease-out;
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .nesab-ai-hdr {
      background: #1a1d29; /* لون كاردات التصميم الجديد */
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #2d313e;
      cursor: grab;
    }

    .nesab-ai-hdr span {
      color: #fde68a; /* نص ذهبي للعنوان */
      font-weight: 700;
      font-size: 0.95rem;
      font-family: 'Cairo', sans-serif;
    }

    .nesab-ai-hdr button {
      background: rgba(255,255,255,0.05);
      border: none;
      color: #8e929d;
      cursor: pointer;
      border-radius: 8px;
      width: 24px;
      height: 24px;
      transition: all 0.2s;
    }

    .nesab-ai-hdr button:hover {
      background: rgba(239, 68, 68, 0.2);
      color: #ff4d4d;
    }

    .nesab-ai-chat {
      padding: 15px;
      background: #090a0f; /* لون الخلفية الأساسي */
      max-height: 350px;
      overflow-y: auto;
      font-family: 'Cairo', sans-serif;
    }

    /* ستايل الرسايل */
    .nesab-ai-msg {
      margin-bottom: 12px;
      color: #ffffff;
      background: #1a1d29;
      padding: 10px 14px;
      border-radius: 12px 12px 0 12px;
      line-height: 1.5;
      font-size: 0.85rem;
      border: 1px solid #242731;
    }

    .nesab-ai-user {
      margin-bottom: 12px;
      color: #12141d;
      background: #fde68a; /* رسايل المستخدم باللون الذهبي */
      padding: 10px 14px;
      border-radius: 12px 12px 12px 0;
      font-weight: 600;
      font-size: 0.85rem;
      align-self: flex-start;
    }

    .nesab-ai-inp {
      display: flex;
      gap: 8px;
      padding: 12px;
      background: #12141d;
      border-top: 1px solid #2d313e;
    }

    .nesab-ai-inp input {
      flex: 1;
      padding: 10px 14px;
      background: #050608;
      border: 1px solid #2d313e;
      border-radius: 10px;
      color: #ffffff;
      font-family: 'Cairo', sans-serif;
      font-size: 0.85rem;
    }

    .nesab-ai-inp input:focus {
      outline: none;
      border-color: #5d5fef;
      box-shadow: 0 0 0 2px rgba(93, 95, 239, 0.1);
    }

    .nesab-ai-inp button {
      padding: 0 16px;
      background: #5d5fef; /* الأزرق الملكي */
      border: none;
      border-radius: 10px;
      color: #fff;
      font-family: 'Cairo', sans-serif;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
    }

    .nesab-ai-inp button:hover {
      background: #4a4cd9;
      transform: translateY(-1px);
    }

    /* Scrollbar Customization */
    .nesab-ai-chat::-webkit-scrollbar { width: 4px; }
    .nesab-ai-chat::-webkit-scrollbar-thumb { background: #2d313e; border-radius: 10px; }

    @media (max-width: 480px) {
      .nesab-ai-panel { width: calc(100vw - 40px); bottom: 90px; }
      .nesab-ai-fab { width: 65px; height: 65px; }
      .nesab-ai-widget {
        right: 10px;
        bottom: 10px;
      }
    }
  `;
  document.head.appendChild(css);

  // ─── INSERT HTML ───
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);

  // ─── KNOWLEDGE BASE ───
  const KB = {
    about:
      "نِسَب منصة حاسبات مالية ذكية أسسها عبدالله المالكي من بريدة. تقدم 17 حاسبة تفاعلية لتمكين العملاء من فهم التمويلات قبل الالتزام. www.Nesab.sa",
    sama: [
      "نسبة الاستقطاع للتمويل الشخصي: 33.33% للموظف، 25% للمتقاعد",
      "نسبة الاستقطاع للتمويل التأجيري: 45% شاملة الشخصي",
      "نسبة الاستقطاع العقاري: 55% (راتب أقل من 15,000) أو 65% (15,000+)",
      "الرسوم الإدارية للشخصي: 0.5% بحد أقصى 2,500 + ضريبة 15%",
      "الرسوم الإدارية للعقاري: 5,750 ريال شامل التقييم",
      "السداد المبكر: شهر أرباح أو 10,000 أيهما أقل",
      "للعميل حق إلغاء طلب التمويل خلال 10 أيام عمل",
    ],
    simah: [
      "السجل الائتماني (سمة) يسجل كل الالتزامات المالية",
      "التأخر 30 يوم = ملاحظة، 90 يوم = تعثر",
      "التعثر يبقى 5 سنوات من تاريخ السداد",
      "تقريرك مجاني مرة كل سنة من simah.com",
    ],
    checks: [
      "الشيك بدون رصيد جريمة يعاقب عليها النظام",
      "الشيك المصدق: البنك يحجز المبلغ ويضمن الصرف",
      "صلاحية الشيك: 6 أشهر من تاريخ التحرير",
    ],
    transfers: [
      "الحوالات المحلية (سريع): فورية 24/7",
      "الدولية: 1-3 أيام عبر SWIFT، رسوم 50-75 ريال",
    ],
    fees: [
      "فتح حساب جاري: مجاني",
      "بطاقة صراف: إصدار مجاني، بدل 30-50 ريال",
      "كشف حساب: مجاني إلكترونياً",
    ],
  };

  // ─── RESPOND TO QUESTIONS ───
  function getResponse(q) {
    q = q.toLowerCase();

    if (q.match(/نسب|nesab|من انت|تعريف|عبدالله|المالكي/)) return KB.about;
    if (q.match(/استقطاع|نسبة|ساما|رسوم|سداد|حد أدنى/)) {
      const results = KB.sama;
      const matches = results.filter((s) =>
        q
          .split(" ")
          .some((w) => w.length > 2 && s.toLowerCase().indexOf(w) > -1),
      );
      return matches.length
        ? matches.join("\n\n")
        : results.slice(0, 3).join("\n\n");
    }
    if (q.match(/سمة|simah|سجل|ائتمان|تعثر/)) return KB.simah.join("\n\n");
    if (q.match(/شيك|شيكات/)) return KB.checks.join("\n\n");
    if (q.match(/حوال|تحويل|swift/)) return KB.transfers.join("\n\n");
    if (q.match(/رسوم|بطاقة|صراف|كشف|حساب/)) return KB.fees.join("\n\n");
    if (q.match(/شخصي/))
      return "التمويل الشخصي: استقطاع 33.33% موظف، 25% متقاعد. رسوم 0.5% بحد 2,500 + ضريبة 15%.";
    if (q.match(/عقاري|سكني/))
      return "التمويل العقاري: استقطاع 55% (راتب<15K) أو 65% (15K+). دعم سكني 150K أو 100K. اعتزاز 160K.";
    if (q.match(/تأجيري|سيارة/)) return "التأجيري: استقطاع 45% شاملة الشخصي.";
    if (q.match(/مديونية/))
      return "شراء المديونية: الصافي = مبلغ الموافقة - الرسوم - المديونية القائمة.";
    if (q.match(/خيرات|وديعة/))
      return "خيرات: هوامش من 3.95% (أسبوعين) إلى 4.45% (سنة). حد أدنى 100,000.";
    if (q.match(/حماية|ادخار/))
      return "الحماية والادخار: تكافلي بدفعة واحدة. تغطية = الأقل بين (المبلغ×10% أو 15K) و 250K.";
    if (q.match(/نقاط|بيع/))
      return "نقاط البيع: تمويل = متوسط شهري × 6. شروط: مبيعات سنوية 400K+، عمر منشأة سنتين+.";
    if (q.match(/مرحبا|هلا|السلام|اهلا|كيف/))
      return "ياهلا فيك! انا مستشارك الائتماني من نِسَب. أقدر أساعدك في أنظمة ساما، السجل الائتماني، الشيكات، الحوالات، الرسوم، ومعلومات التمويل. تفضل اسألني!";

    return "انا مستشارك الائتماني من نِسَب. أقدر أساعدك في أنظمة ساما، سمة، الشيكات، الحوالات، الرسوم البنكية، ومعلومات كل المنتجات. حدد سؤالك!";
  }

  // ─── DRAG HANDLER ───
  function setupDragHandler() {
    const widget = document.getElementById("nesabAiWidget");
    const fab = document.getElementById("nesabAiFab");
    const dragHandle = document.getElementById("nesabAiDragHandle");

    let isDragging = false;
    let hasMoved = false;
    let startX = 0;
    let startY = 0;
    let offsetX = 0;
    let offsetY = 0;
    const DRAG_THRESHOLD = 5;
    let hasSavedPosition = false;

    try {
      hasSavedPosition = localStorage.getItem(HAS_SAVED_POSITION) === "true";
    } catch (e) {
      hasSavedPosition = false;
    }

    function getBoundaries() {
      const rect = widget.getBoundingClientRect();
      return {
        minX: 0,
        maxX: window.innerWidth - rect.width - 10,
        minY: 0,
        maxY: window.innerHeight - rect.height - 10,
      };
    }

    function constrainPosition(x, y) {
      const bounds = getBoundaries();
      return {
        x: Math.max(bounds.minX, Math.min(x, bounds.maxX)),
        y: Math.max(bounds.minY, Math.min(y, bounds.maxY)),
      };
    }

    function savePosition() {
      try {
        const left = parseInt(widget.style.left) || 0;
        const top = parseInt(widget.style.top) || 0;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: left, y: top }));
        localStorage.setItem(HAS_SAVED_POSITION, "true");
      } catch (e) {
        console.warn("Could not save position");
      }
    }

    function loadPosition() {
      if (!hasSavedPosition) return;

      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const pos = JSON.parse(saved);
          const constrained = constrainPosition(pos.x || 20, pos.y || 20);

          widget.classList.add("repositioned");
          widget.style.left = constrained.x + "px";
          widget.style.top = constrained.y + "px";
          widget.style.right = "auto";
          widget.style.bottom = "auto";
        }
      } catch (e) {
        console.warn("Could not load position");
      }
    }

    function onPointerDown(e) {
      if (e.target.tagName === "BUTTON" && e.target !== fab) return;

      isDragging = true;
      hasMoved = false;
      startX = e.clientX || e.touches?.[0].clientX || 0;
      startY = e.clientY || e.touches?.[0].clientY || 0;

      const rect = widget.getBoundingClientRect();
      offsetX = rect.left;
      offsetY = rect.top;

      widget.style.cursor = "grabbing";
      widget.classList.add("dragging");

      if (!widget.classList.contains("repositioned")) {
        widget.classList.add("repositioned");
        widget.style.left = offsetX + "px";
        widget.style.top = offsetY + "px";
        widget.style.right = "auto";
        widget.style.bottom = "auto";
      }
    }

    function onPointerMove(e) {
      if (!isDragging) return;

      const currentX = e.clientX || e.touches?.[0].clientX || 0;
      const currentY = e.clientY || e.touches?.[0].clientY || 0;
      const dx = currentX - startX;
      const dy = currentY - startY;

      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        hasMoved = true;
      }

      if (hasMoved) {
        const newX = offsetX + dx;
        const newY = offsetY + dy;
        const constrained = constrainPosition(newX, newY);

        widget.style.left = constrained.x + "px";
        widget.style.top = constrained.y + "px";
        widget.style.right = "auto";
        widget.style.bottom = "auto";
      }
    }

    function onPointerUp(e) {
      if (!isDragging) return;

      isDragging = false;
      widget.style.cursor = "grab";
      widget.classList.remove("dragging");

      if (hasMoved) {
        savePosition();
        hasSavedPosition = true;
      }
    }

    // FAB Click Handler - separate from drag logic
    fab.addEventListener("click", (e) => {
      if (!hasMoved) {
        window.NesabAI.toggle();
      }
      e.stopPropagation();
    });

    // FAB Drag Events
    fab.addEventListener("mousedown", onPointerDown);
    fab.addEventListener("touchstart", onPointerDown, { passive: true });

    // Header Events
    dragHandle.addEventListener("mousedown", onPointerDown);
    dragHandle.addEventListener("touchstart", onPointerDown, { passive: true });

    // Document Events
    document.addEventListener("mousemove", onPointerMove);
    document.addEventListener("touchmove", onPointerMove, { passive: true });

    document.addEventListener("mouseup", onPointerUp);
    document.addEventListener("touchend", onPointerUp, { passive: true });

    window.addEventListener("resize", () => {
      if (!isDragging && widget.classList.contains("repositioned")) {
        const pos = {
          x: parseInt(widget.style.left) || 50,
          y: parseInt(widget.style.top) || 50,
        };
        const constrained = constrainPosition(pos.x, pos.y);
        widget.style.left = constrained.x + "px";
        widget.style.top = constrained.y + "px";
      }
    });

    // Load saved position on init
    loadPosition();
  }

  // ─── PUBLIC API ───
  window.NesabAI = {
    toggle: function () {
      document.getElementById("nesabAiPanel").classList.toggle("open");
    },
    ask: async function () {
      const input = document.getElementById("nesabAiQ");
      const question = input.value.trim();
      if (!question) return;

      const chatBox = document.getElementById("nesabAiChat");
      chatBox.innerHTML +=
        '<div class="nesab-ai-user">انت: ' + question + "</div>";
      input.value = "";

      // Show loading indicator
      const loadingMsg = document.createElement("div");
      loadingMsg.className = "nesab-ai-msg";
      loadingMsg.innerHTML =
        '<span class="nesab-ai-name">نسب:</span> <span style="opacity: 0.6;">جاري المعالجة...</span>';
      chatBox.appendChild(loadingMsg);
      chatBox.scrollTop = chatBox.scrollHeight;

      try {
        // Try calling the API first
        // Extract page slug from URL (e.g. "/shakhsi-plus.html" -> "shakhsi-plus")
        const pageContext = window.location.pathname.split("/").pop().replace(/\.(html?|php)$/, "") || "";

        const response = await fetch("https://api.nesab.sa/chat.php", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: question,
            context: pageContext,
            history: conversationHistory.slice(-8),
            // user_id omitted — backend resolves identity via IP fallback
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const answer = data.reply || getResponse(question); // fallback if reply field absent
          loadingMsg.innerHTML =
            '<span class="nesab-ai-name">نسب:</span> ' + answer;
          // Accumulate this turn in session memory
          conversationHistory.push({ role: "user", content: question });
          conversationHistory.push({ role: "assistant", content: answer });
        } else {
          // Fall back to local KB if API fails
          const answer = getResponse(question);
          loadingMsg.innerHTML =
            '<span class="nesab-ai-name">نسب:</span> ' + answer;
        }
      } catch (err) {
        // Fall back to local KB if API call fails
        console.warn("API call failed, using local KB:", err);
        const answer = getResponse(question);
        loadingMsg.innerHTML =
          '<span class="nesab-ai-name">نسب:</span> ' + answer;
      }

      chatBox.scrollTop = chatBox.scrollHeight;
    },
  };

  // Backward compatibility
  window.toggleAI = window.NesabAI.toggle;
  window.askAI = window.NesabAI.ask;

  // Initialize drag handler
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupDragHandler);
  } else {
    setupDragHandler();
  }
})();
