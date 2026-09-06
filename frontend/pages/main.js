/**
 * main.js – Page-level orchestration and form handling
 */

(function () {
  'use strict';

  /* ── Contact Form ─────────────────────────────────────── */
  const form = document.getElementById('contact-form');
  const submitBtn = document.getElementById('submit-btn');

  if (form && submitBtn) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name  = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();

      if (!name || !email) {
        showToast('Please fill in all required fields.', 'error');
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Please enter a valid email address.', 'error');
        return;
      }

      // Simulate async submit
      submitBtn.disabled = true;
      submitBtn.querySelector('span').textContent = 'Sending...';

      await new Promise(r => setTimeout(r, 1400));

      submitBtn.disabled = false;
      submitBtn.querySelector('span').textContent = 'Send Request';
      form.reset();
      showToast('✅ Request sent! Our team will contact you within 24 hours.', 'success');
    });
  }

  /* ── Toast Notification ───────────────────────────────── */
  function showToast(msg, type = 'info') {
    const existing = document.getElementById('toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'toast';
    const colors = { success: '#059669', error: '#DC2626', info: '#0056B3' };
    Object.assign(toast.style, {
      position:     'fixed',
      bottom:       '2rem',
      right:        '2rem',
      background:   '#FFFFFF',
      border:       '1px solid rgba(195, 178, 150, 0.45)',
      borderLeft:   `4px solid ${colors[type]}`,
      color:        '#0F172A',
      padding:      '1rem 1.4rem',
      borderRadius: '10px',
      fontFamily:   'Inter, sans-serif',
      fontSize:     '0.875rem',
      fontWeight:   '600',
      maxWidth:     '360px',
      zIndex:       '9999',
      backdropFilter: 'blur(16px)',
      boxShadow:    '0 8px 30px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04)',
      transform:    'translateY(20px)',
      opacity:      '0',
      transition:   'transform 0.35s ease, opacity 0.35s ease',
    });
    toast.textContent = msg;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity   = '1';
    });

    setTimeout(() => {
      toast.style.transform = 'translateY(20px)';
      toast.style.opacity   = '0';
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  }

  /* ── Launch Dashboard Button ──────────────────────────── */
  const launchBtn = document.getElementById('launch-btn');
  if (launchBtn) {
    launchBtn.addEventListener('click', () => {
      window.location.href = 'frontend/pages/admin-dashboard.html';
    });
  }

  /* ── Watch Demo Button ────────────────────────────────── */
  const watchBtn = document.getElementById('watch-demo-btn');
  if (watchBtn) {
    watchBtn.addEventListener('click', () => {
      showToast('🎬 Demo video coming soon! Contact us for a live walkthrough.', 'info');
    });
  }

  /* ── Page Load Animation ──────────────────────────────── */
  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity 0.6s ease';
  window.addEventListener('load', () => {
    document.body.style.opacity = '1';
  });

  /* ── Smooth anchor scrolling ──────────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  console.log('%c🚆 IR AI Block Planner', 'color:#003366;font-size:18px;font-weight:bold;font-family:monospace');
  console.log('%cVersion 1.0.0 | Ministry of Railways, Government of India', 'color:#64748B;font-size:11px;font-family:monospace');
})();
