(() => {
  'use strict';

  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const icon = (name) => {
    const paths = {
      arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
      play: '<path d="M8 5v14l11-7z"/>',
      pause: '<path d="M8 5v14M16 5v14"/>',
    };
    return `<svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.arrow}</svg>`;
  };
  window.portfolioIcon = icon;

  // 3D loads only after explicit visitor intent.
  let threePromise = null;
  const mark3DFailure = () => {
    document.documentElement.classList.remove('three-loading');
    document.documentElement.classList.add('three-load-error');
    qsa('.stage-fallback').forEach((element) => {
      element.setAttribute('aria-hidden', 'false');
      element.innerHTML = '<strong>Interactive 3D is unavailable.</strong><span>The static project posters and written case studies remain available.</span>';
    });
  };
  const loadPortfolio3D = () => {
    if (window.__portfolio3DReady) return Promise.resolve(true);
    if (threePromise) return threePromise;
    document.documentElement.classList.add('three-loading');
    threePromise = import('./three-scenes.js')
      .then(() => {
        document.documentElement.classList.remove('three-loading');
        document.documentElement.classList.add('three-ready');
        return true;
      })
      .catch((error) => {
        console.error('3D engine failed to load:', error);
        mark3DFailure();
        return false;
      });
    return threePromise;
  };
  window.loadPortfolio3D = loadPortfolio3D;

  // Performance state is explicit: the button always reports the current mode.
  const performanceToggle = qs('#performance-toggle');
  const savedMode = localStorage.getItem('portfolio-performance');
  const defaultLow = Boolean(navigator.connection?.saveData || matchMedia('(max-width: 760px)').matches);
  const applyPerformanceMode = (mode) => {
    const low = mode === 'low';
    document.body.dataset.performance = low ? 'low' : 'full';
    document.documentElement.dataset.performance = low ? 'low' : 'full';
    if (performanceToggle) {
      performanceToggle.setAttribute('aria-pressed', String(low));
      performanceToggle.textContent = low ? 'Performance: Eco' : 'Performance: Full';
      performanceToggle.title = low ? 'Eco mode is active; click for full 3D quality' : 'Full 3D quality is active; click for eco mode';
    }
    window.dispatchEvent(new CustomEvent('portfolio-performance-change', { detail: { mode: low ? 'low' : 'full' } }));
  };
  applyPerformanceMode(savedMode || (defaultLow ? 'low' : 'full'));
  performanceToggle?.addEventListener('click', () => {
    const next = document.body.dataset.performance === 'low' ? 'full' : 'low';
    localStorage.setItem('portfolio-performance', next);
    applyPerformanceMode(next);
  });

  // Mobile navigation.
  const navToggle = qs('.nav-toggle');
  const navLinks = qs('#nav-links');
  if (navToggle && navLinks) {
    const setOpen = (open) => {
      navLinks.classList.toggle('open', open);
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      document.body.classList.toggle('nav-open', open);
      if (!open && document.activeElement && navLinks.contains(document.activeElement)) navToggle.focus();
    };
    navToggle.addEventListener('click', () => setOpen(!navLinks.classList.contains('open')));
    qsa('a', navLinks).forEach((link) => link.addEventListener('click', () => setOpen(false)));
    addEventListener('keydown', (event) => { if (event.key === 'Escape') setOpen(false); });
    document.addEventListener('pointerdown', (event) => {
      if (navLinks.classList.contains('open') && !navLinks.contains(event.target) && !navToggle.contains(event.target)) setOpen(false);
    });
    addEventListener('resize', () => { if (innerWidth > 760) setOpen(false); });
  }

  // Scroll progress.
  const progress = qs('#scroll-progress-bar');
  const updateProgress = () => {
    if (!progress) return;
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    progress.style.width = `${Math.min(100, (scrollY / max) * 100)}%`;
  };
  updateProgress();
  addEventListener('scroll', updateProgress, { passive: true });
  addEventListener('resize', updateProgress);

  // Progressive reveal; no-JS content remains visible.
  const revealItems = qsa('.reveal');
  revealItems.forEach((element) => element.style.setProperty('--delay', `${Number(element.dataset.delay || 0)}ms`));
  if ('IntersectionObserver' in window && !reducedMotion) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -3% 0px' });
    revealItems.forEach((element) => observer.observe(element));
  } else {
    revealItems.forEach((element) => element.classList.add('visible'));
  }

  // Same-page navigation.
  qsa('a[href^="#"]').forEach((anchor) => anchor.addEventListener('click', (event) => {
    const selector = anchor.getAttribute('href');
    if (!selector || selector === '#') return;
    const target = qs(selector);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }));

  // Active navigation state.
  const navMap = new Map();
  qsa('.nav-links a[href^="#"]').forEach((link) => {
    const section = qs(link.getAttribute('href'));
    if (section) navMap.set(section, link);
  });
  if ('IntersectionObserver' in window) {
    const ratios = new Map();
    const activeObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => ratios.set(entry.target, entry.intersectionRatio));
      let activeSection = null;
      let best = 0;
      ratios.forEach((ratio, section) => {
        if (ratio > best) { best = ratio; activeSection = section; }
      });
      navMap.forEach((link, section) => {
        if (section === activeSection && best > 0.08) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-20% 0px -62% 0px', threshold: [0, .1, .25, .5] });
    navMap.forEach((_, section) => activeObserver.observe(section));
  }

  // Hero tabs keep native tab semantics after 3D is loaded.
  const heroTabs = qsa('[data-hero-scene]');
  heroTabs.forEach((tab, index) => tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % heroTabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + heroTabs.length) % heroTabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = heroTabs.length - 1;
    heroTabs[next].focus();
    heroTabs[next].click();
  }));

  // Explicit 3D entry point. First click loads the module, second synthetic click
  // reaches the listener installed by three-scenes.js and starts the deep tour.
  const guidedTour = qs('#guided-tour');
  guidedTour?.addEventListener('click', async (event) => {
    if (window.__portfolio3DReady) return;
    event.preventDefault();
    const original = guidedTour.textContent;
    guidedTour.disabled = true;
    guidedTour.textContent = 'Loading 3D stories…';
    const loaded = await loadPortfolio3D();
    guidedTour.disabled = false;
    if (!loaded) {
      guidedTour.textContent = '3D unavailable · view case studies below';
      return;
    }
    guidedTour.textContent = original;
    guidedTour.click();
  });

  // Compact recruiter view. Expanding a technical story is also explicit 3D intent.
  const storyMap = {
    'complaints-project': 'complaints',
    'agentic-project': 'audit',
    'rag-project': 'rag',
  };
  const labelMap = {
    'complaints-project': ['Explore full analytics story', 'Return to recruiter view'],
    'agentic-project': ['Explore full audit story', 'Return to recruiter view'],
    'rag-project': ['Explore full retrieval story', 'Return to recruiter view'],
  };
  qsa('[data-case-toggle]').forEach((button) => {
    const project = document.getElementById(button.dataset.caseToggle);
    if (!project) return;
    button.addEventListener('click', async () => {
      const expanded = !project.classList.contains('is-expanded');
      project.classList.toggle('is-expanded', expanded);
      project.dataset.expanded = String(expanded);
      button.setAttribute('aria-expanded', String(expanded));
      button.textContent = labelMap[project.id][expanded ? 1 : 0];
      if (!expanded) return;
      const loaded = await loadPortfolio3D();
      if (loaded) window.__portfolioEnsureScene?.(storyMap[project.id]);
      window.setTimeout(() => {
        project.querySelector('.story-stage')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
      }, reducedMotion ? 0 : 120);
    });
  });

  // Image lightbox.
  const dialog = qs('#lightbox');
  const dialogImage = qs('#lightbox-image');
  const dialogCaption = qs('#lightbox-caption');
  let lightboxTrigger = null;
  qsa('[data-lightbox]').forEach((button) => button.addEventListener('click', () => {
    if (!dialog || !dialogImage) return;
    lightboxTrigger = button;
    dialogImage.src = button.dataset.lightbox;
    dialogImage.alt = button.querySelector('img')?.alt || 'Project screenshot';
    if (dialogCaption) dialogCaption.textContent = button.dataset.caption || '';
    dialog.showModal?.();
  }));
  const closeLightbox = () => { dialog?.close(); lightboxTrigger?.focus(); };
  qs('.lightbox-close')?.addEventListener('click', closeLightbox);
  dialog?.addEventListener('click', (event) => { if (event.target === dialog) closeLightbox(); });
  dialog?.addEventListener('cancel', (event) => { event.preventDefault(); closeLightbox(); });

  // Contact form with direct-email fallback.
  const form = qs('#contact-form');
  const submit = qs('#contact-submit');
  const status = qs('#form-status');
  if (form) {
    try {
      const recipient = atob(form.dataset.recipient || '');
      form.action = `https://formsubmit.co/ajax/${recipient}`;
    } catch { /* direct email remains visible */ }
  }
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      status.className = 'form-status full error';
      status.textContent = 'Please complete your name, valid email and message.';
      return;
    }
    const original = submit.innerHTML;
    submit.disabled = true;
    submit.innerHTML = `<span>Submitting…</span>${icon('arrow')}`;
    status.className = 'form-status full';
    status.textContent = 'Submitting your message…';
    try {
      const response = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false || payload.success === 'false') throw new Error(payload.message || 'Submission failed');
      form.reset();
      status.className = 'form-status full success';
      status.textContent = 'Your message was submitted successfully.';
    } catch {
      status.className = 'form-status full error';
      status.innerHTML = 'The form service could not confirm submission. Email <a href="mailto:shivamrajput.datascientist@gmail.com">shivamrajput.datascientist@gmail.com</a> directly.';
    } finally {
      submit.disabled = false;
      submit.innerHTML = original;
    }
  });

  // Email copy fallback.
  const copyButton = qs('#copy-email');
  copyButton?.addEventListener('click', async () => {
    const email = 'shivamrajput.datascientist@gmail.com';
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      const input = document.createElement('textarea');
      input.value = email;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    copyButton.textContent = 'Email copied';
    setTimeout(() => { copyButton.textContent = 'Copy email'; }, 1800);
  });

  const year = qs('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
