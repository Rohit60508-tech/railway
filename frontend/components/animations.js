/**
 * animations.js
 * Scroll-driven animations using IntersectionObserver:
 *  - Feature cards staggered reveal
 *  - Timeline steps reveal
 *  - Counter animation for hero stats
 *  - Track progress bar fill
 */

(function () {
  'use strict';

  /* ── Feature Card Reveal ─────────────────────────────── */
  const featureCards = document.querySelectorAll('.feature-card');
  if (featureCards.length) {
    const cardObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const card = entry.target;
          const delay = parseInt(card.dataset.delay || '0', 10);
          setTimeout(() => card.classList.add('visible'), delay);
          cardObserver.unobserve(card);
        }
      });
    }, { threshold: 0.15 });

    featureCards.forEach(card => cardObserver.observe(card));
  }

  /* ── Timeline Steps Reveal ────────────────────────────── */
  const timelineSteps = document.querySelectorAll('.timeline-step');
  if (timelineSteps.length) {
    timelineSteps.forEach(step => {
      step.style.opacity = '0';
      step.style.transform = 'translateX(-20px)';
      step.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    });

    const stepObserver = new IntersectionObserver(entries => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateX(0)';
          }, i * 120);
          stepObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });

    timelineSteps.forEach(step => stepObserver.observe(step));
  }

  /* ── Hero Counter Animation ───────────────────────────── */
  function animateCounter(el, target, duration, isDecimal) {
    const start = performance.now();
    const startVal = 0;

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = startVal + (target - startVal) * eased;

      el.textContent = isDecimal
        ? value.toFixed(2)
        : Math.round(value).toLocaleString('en-IN');

      if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
  }

  const heroSection = document.getElementById('home');
  if (heroSection) {
    const counterObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        const trainEl   = document.getElementById('stat-trains');
        const kmEl      = document.getElementById('stat-km');
        const uptimeEl  = document.getElementById('stat-uptime');

        if (trainEl)  animateCounter(trainEl,  14000,  1800, false);
        if (kmEl)     animateCounter(kmEl,     68000,  2200, false);
        if (uptimeEl) animateCounter(uptimeEl, 99.97,  1600, true);

        counterObserver.disconnect();
      }
    }, { threshold: 0.5 });
    counterObserver.observe(heroSection);
  }

  /* ── Track Progress Bar ───────────────────────────────── */
  const trackFill = document.getElementById('track-fill-1');
  if (trackFill) {
    setTimeout(() => {
      trackFill.style.width = '58%';
    }, 800);
  }

  /* ── Live Metrics Flicker ─────────────────────────────── */
  function randomFlicker(id, baseVal, unit, variance) {
    const el = document.getElementById(id);
    if (!el) return;
    setInterval(() => {
      const v = baseVal + Math.floor((Math.random() - 0.5) * variance);
      el.textContent = v.toLocaleString('en-IN') + (unit || '');
    }, 2500 + Math.random() * 1000);
  }

  randomFlicker('active-trains',   8241, '',    120);
  randomFlicker('blocks-allocated',23456, '',   300);
  randomFlicker('response-time',   47,   'ms',  10);

  // Efficiency stays near constant, just gentle drift
  const effEl = document.getElementById('efficiency');
  if (effEl) {
    setInterval(() => {
      const v = 97.5 + Math.random() * 0.6;
      effEl.textContent = v.toFixed(1) + '%';
    }, 3000);
  }

  /* ── Navbar Scroll State ──────────────────────────────── */
  const navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 50);
    }, { passive: true });
  }

  /* ── Active Nav Link on Scroll ────────────────────────── */
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  if (sections.length && navLinks.length) {
    const linkObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${entry.target.id}`) {
              link.classList.add('active');
            }
          });
        }
      });
    }, { threshold: 0.4 });

    sections.forEach(s => linkObserver.observe(s));
  }

  /* ── Hamburger Menu ───────────────────────────────────── */
  const hamburger = document.getElementById('hamburger');
  const navLinksList = document.getElementById('nav-links');

  if (hamburger && navLinksList) {
    hamburger.addEventListener('click', () => {
      navLinksList.classList.toggle('open');
      const spans = hamburger.querySelectorAll('span');
      hamburger.classList.toggle('active');

      if (hamburger.classList.contains('active')) {
        spans[0].style.transform = 'translateY(7px) rotate(45deg)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'translateY(-7px) rotate(-45deg)';
      } else {
        spans[0].style.transform = '';
        spans[1].style.opacity = '';
        spans[2].style.transform = '';
      }
    });

    navLinksList.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navLinksList.classList.remove('open');
        hamburger.classList.remove('active');
        hamburger.querySelectorAll('span').forEach(s => {
          s.style.transform = '';
          s.style.opacity = '';
        });
      });
    });
  }

  /* ── Section Entrance Animations ─────────────────────── */
  const animSections = document.querySelectorAll('.section-header');
  animSections.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  });

  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        sectionObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  animSections.forEach(el => sectionObserver.observe(el));

  /* ── Dashboard Tab Switch (UI demo) ───────────────────── */
  document.querySelectorAll('.db-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.db-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  document.querySelectorAll('.db-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.db-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });

  /* ── Smooth Explore Button ────────────────────────────── */
  const exploreBtn = document.getElementById('explore-btn');
  if (exploreBtn) {
    exploreBtn.addEventListener('click', () => {
      document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

})();
