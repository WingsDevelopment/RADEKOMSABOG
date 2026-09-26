import { pickQuote } from './content/quotes.js';

export function createQuoteEngine(i18n, isMotionPaused) {
  const toast = document.querySelector('#quote-toast');
  let activeQuote = null;
  let dismissTimer;
  let lastShown = -Infinity;
  let priorityUntil = 0;
  let isPriority = false;
  let returnFocus = null;
  const refresh = () => {
    if (!activeQuote) return;
    document.querySelector('#quote-label').textContent = i18n.t(isPriority ? 'quote.transmission' : 'quote.label');
    document.querySelector('#quote-text').textContent = activeQuote[i18n.language];
  };
  const dismiss = () => {
    clearTimeout(dismissTimer);
    if (toast.contains(document.activeElement)) {
      const target = returnFocus?.isConnected && returnFocus.getClientRects().length ? returnFocus : document.querySelector('[data-language="' + i18n.language + '"]');
      target?.focus({ preventScroll: true });
    }
    toast.hidden = true;
    activeQuote = null;
    priorityUntil = 0;
  };
  const scheduleDismiss = () => {
    clearTimeout(dismissTimer);
    dismissTimer = setTimeout(() => {
      if (!toast.matches(':hover') && !toast.contains(document.activeElement)) dismiss();
    }, isPriority ? 2600 : 5000);
  };
  document.querySelector('#quote-close').addEventListener('click', dismiss);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !toast.hidden) dismiss(); });
  toast.addEventListener('mouseenter', () => clearTimeout(dismissTimer));
  toast.addEventListener('mouseleave', scheduleDismiss);
  toast.addEventListener('focusin', () => clearTimeout(dismissTimer));
  toast.addEventListener('focusout', scheduleDismiss);
  return {
    refresh,
    show(trigger) {
      const now = performance.now();
      const priority = trigger === 'signup';
      if (!priority && (now < priorityUntil || now - lastShown < 2200)) return;
      const quote = pickQuote(trigger);
      if (!quote) return;
      lastShown = now;
      activeQuote = quote;
      isPriority = priority;
      if (!toast.contains(document.activeElement)) returnFocus = document.activeElement;
      if (priority) priorityUntil = now + 2800;
      toast.classList.toggle('priority', priority);
      toast.classList.toggle('quiet', isMotionPaused());
      toast.hidden = false;
      refresh();
      scheduleDismiss();
      // Future audio modules may subscribe. Nothing loads or plays audio in this version.
      document.dispatchEvent(new CustomEvent('rade:quote', { detail: { id: quote.id, language: i18n.language, audio: quote.audio, trigger } }));
    },
  };
}
