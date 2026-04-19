document.addEventListener("DOMContentLoaded", function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animatedElements = Array.from(document.querySelectorAll(".anim"));
  const counters = Array.from(document.querySelectorAll("[data-count]"));
  const heroVisual = document.querySelector(".nesab-hero-visual");
  const counted = new WeakSet();

  function revealElement(element) {
    element.classList.add("anim--visible");
  }

  function animateCounter(element) {
    if (counted.has(element)) {
      return;
    }

    counted.add(element);
    const endValue = Number(element.dataset.count || element.textContent || 0);
    const duration = 1400;
    const start = performance.now();

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = String(Math.round(endValue * eased));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        element.textContent = String(endValue);
      }
    }

    window.requestAnimationFrame(step);
  }

  if (reduceMotion) {
    animatedElements.forEach(revealElement);
    counters.forEach(function (counter) {
      counter.textContent = counter.dataset.count || counter.textContent;
    });
  } else {
    const revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }

        revealElement(entry.target);
        observer.unobserve(entry.target);
      });
    }, {
      threshold: 0.18,
      rootMargin: "0px 0px -8% 0px"
    });

    animatedElements.forEach(function (element) {
      revealObserver.observe(element);
    });

    const countObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }

        animateCounter(entry.target);
        observer.unobserve(entry.target);
      });
    }, {
      threshold: 0.5
    });

    counters.forEach(function (counter) {
      countObserver.observe(counter);
    });

    if (heroVisual) {
      heroVisual.addEventListener("pointermove", function (event) {
        const rect = heroVisual.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - 0.5) * 18;
        const y = ((event.clientY - rect.top) / rect.height - 0.5) * 18;
        heroVisual.style.setProperty("--hero-shift-x", x.toFixed(2) + "px");
        heroVisual.style.setProperty("--hero-shift-y", y.toFixed(2) + "px");
      });

      heroVisual.addEventListener("pointerleave", function () {
        heroVisual.style.setProperty("--hero-shift-x", "0px");
        heroVisual.style.setProperty("--hero-shift-y", "0px");
      });
    }
  }
});
