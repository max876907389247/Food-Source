const navToggle = document.querySelector(".nav__toggle");
const navList = document.querySelector(".nav__list");
const navLinks = document.querySelectorAll(".nav__list a");

if (navToggle && navList) {
  navToggle.addEventListener("click", () => {
    const isOpen = navList.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      navList.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("click", (event) => {
    if (!navToggle.contains(event.target) && !navList.contains(event.target)) {
      navList.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
}

const sections = document.querySelectorAll("section[id]");
const navAnchors = document.querySelectorAll('.nav__list a[href^="#"]');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      navAnchors.forEach((anchor) => {
        const href = anchor.getAttribute("href");
        anchor.classList.toggle("is-active", href === `#${entry.target.id}`);
      });
    });
  },
  { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
);

sections.forEach((section) => observer.observe(section));

const revealSections = document.querySelectorAll(".section");
revealSections.forEach((section) => section.classList.add("reveal"));

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);

revealSections.forEach((section) => revealObserver.observe(section));

const initSlider = (slider) => {
  const slides = slider.querySelectorAll(".about-slider__slide");
  const dots = slider.querySelectorAll(".about-slider__dot");
  const prevBtn = slider.querySelector("[data-slider-prev]");
  const nextBtn = slider.querySelector("[data-slider-next]");
  let current = 0;
  let timer;

  const showSlide = (index) => {
    current = (index + slides.length) % slides.length;

    slides.forEach((slide, i) => {
      slide.classList.toggle("is-active", i === current);
    });

    dots.forEach((dot, i) => {
      const isActive = i === current;
      dot.classList.toggle("is-active", isActive);
      dot.setAttribute("aria-selected", String(isActive));
    });
  };

  const next = () => showSlide(current + 1);
  const prev = () => showSlide(current - 1);

  const restartTimer = () => {
    clearInterval(timer);
    timer = setInterval(next, 5000);
  };

  prevBtn?.addEventListener("click", () => {
    prev();
    restartTimer();
  });

  nextBtn?.addEventListener("click", () => {
    next();
    restartTimer();
  });

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      showSlide(Number(dot.dataset.sliderTo));
      restartTimer();
    });
  });

  restartTimer();
};

document.querySelectorAll("[data-slider]").forEach(initSlider);
