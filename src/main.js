import './style.css';
import { validateSignup } from './validation.js';
import { createI18n } from './i18n.js';
import { createLayout } from './layout.js';
import { createQuoteEngine } from './quote-engine.js';

let storage;
try { storage = window.localStorage; } catch { /* Language switching works without storage. */ }
const i18n = createI18n(storage);
document.querySelector('#app').innerHTML = createLayout(i18n);
const $ = selector => document.querySelector(selector);
const form = $('#signup-form');
const processing = $('#processing');
const success = $('#success');
const errorBox = $('#form-error');
const submit = form.querySelector('[type="submit"]');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let motionPaused = reducedMotion.matches;
let busy = false;
let errorCode = null;
let stageIndex = 0;
let rotationIndex = 0;
let survival = null;
let signupAnnounced = false;
let judgmentTimer;
const quotes = createQuoteEngine(i18n, () => motionPaused);
const protocolEvent = stage => document.dispatchEvent(new CustomEvent('rade:protocol', { detail: { stage, language: i18n.language } }));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function motionLabel() {
  const button = $('#motion-toggle');
  const label = i18n.t(motionPaused ? 'a11y.resume' : 'a11y.pause');
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  button.setAttribute('aria-pressed', String(motionPaused));
  button.firstElementChild.textContent = motionPaused ? '▷' : 'Ⅱ';
}
function refreshLanguage() {
  document.documentElement.lang = i18n.language === 'sr' ? 'sr-Latn' : 'en';
  document.title = i18n.t('meta.title');
  $('meta[name="description"]').content = i18n.t('meta.description');
  $('meta[property="og:title"]').content = i18n.t('meta.title');
  $('meta[property="og:description"]').content = i18n.t('meta.description');
  document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = i18n.t(element.dataset.i18n); });
  for (const attribute of ['placeholder', 'aria-label']) {
    document.querySelectorAll(`[data-i18n-${attribute}]`).forEach(element => element.setAttribute(attribute, i18n.t(element.getAttribute(`data-i18n-${attribute}`))));
  }
  document.querySelectorAll('[data-language]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === i18n.language)));
  document.querySelectorAll('[data-count]').forEach(element => { element.textContent = i18n.format(Number(element.dataset.current || 0), Number(element.dataset.decimals)); });
  document.querySelectorAll('[data-number]').forEach(element => { element.textContent = i18n.format(Number(element.dataset.number)); });
  $('#rotating-subtitle').textContent = i18n.t(`hero.rotations.${rotationIndex}`);
  $('#processing-text').textContent = stageIndex < i18n.t('signup.stages').length ? i18n.t(`signup.stages.${stageIndex}`) : i18n.t('signup.awaiting');
  if (errorCode) errorBox.textContent = i18n.t(`errors.${errorCode}`);
  if (survival !== null) $('#survival').textContent = `${i18n.format(survival, 1)}%`;
  $('#gpu-load').textContent = `${i18n.format(99.98, 2)}%`;
  motionLabel();
  quotes.refresh();
}
document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => { i18n.setLanguage(button.dataset.language); refreshLanguage(); }));
function setMotion(paused) {
  motionPaused = paused;
  document.documentElement.classList.toggle('motion-paused', paused);
  motionLabel();
}
$('#motion-toggle').addEventListener('click', () => setMotion(!motionPaused));
reducedMotion.addEventListener('change', event => setMotion(event.matches));
setMotion(motionPaused);
refreshLanguage();

function announceSignup() {
  if (signupAnnounced) return;
  signupAnnounced = true;
  quotes.show('signup');
}
document.querySelectorAll('.challenge-cta').forEach(link => link.addEventListener('click', announceSignup));
form.addEventListener('focusin', announceSignup, { once: true });
document.querySelectorAll('[data-quote-trigger]').forEach(element => element.addEventListener('click', () => quotes.show(element.dataset.quoteTrigger)));
document.querySelectorAll('[data-faq-id]').forEach(details => details.addEventListener('toggle', () => { if (details.open) quotes.show('faq'); }));

async function processingSequence() {
  for (stageIndex = 0; stageIndex < i18n.t('signup.stages').length; stageIndex++) {
    $('#processing-text').textContent = i18n.t(`signup.stages.${stageIndex}`);
    protocolEvent(`processing:${stageIndex}`);
    await pause(380);
  }
  $('#processing-text').textContent = i18n.t('signup.awaiting');
}
async function saveSignup(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept-Language': i18n.language }, body: JSON.stringify(payload), signal: controller.signal });
    let result;
    try { result = await response.json(); } catch { return { ok: false, code: 'unavailable' }; }
    if (!response.ok || result.success !== true) {
      const fallback = { 429: 'rateLimit', 403: 'origin', 413: 'large', 415: 'contentType', 400: 'invalidBody' }[response.status] || 'unavailable';
      return { ok: false, code: Object.hasOwn(i18n.t('errors'), result.errorCode) ? result.errorCode : fallback };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error.name === 'AbortError' ? 'timeout' : 'network' };
  } finally { clearTimeout(timeout); }
}
function showError(code, field) {
  errorCode = code;
  errorBox.textContent = i18n.t(`errors.${code}`);
  errorBox.hidden = false;
  if (field) { field.setAttribute('aria-invalid', 'true'); field.focus({ preventScroll: true }); }
}
form.addEventListener('input', event => { event.target.removeAttribute('aria-invalid'); });
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  announceSignup();
  errorCode = null;
  errorBox.hidden = true;
  form.querySelectorAll('[aria-invalid]').forEach(field => field.removeAttribute('aria-invalid'));
  const fields = new FormData(form);
  const emptyField = ['steamNick', 'steamLink', 'mmr'].find(name => !String(fields.get(name)).trim());
  if (emptyField) { showError(emptyField === 'mmr' && $('#mmr').validity.badInput ? 'mmr' : 'required', form.elements[emptyField]); return; }
  const payload = { steamNick: fields.get('steamNick'), steamLink: fields.get('steamLink'), mmr: Number(fields.get('mmr')), website: fields.get('website') };
  const checked = validateSignup(payload);
  if (checked.error) { showError(checked.errorCode, form.elements[{ nick: 'steamNick', link: 'steamLink', mmr: 'mmr' }[checked.errorCode]]); return; }
  busy = true;
  const hadFormFocus = form.contains(document.activeElement);
  submit.disabled = true;
  form.hidden = true;
  processing.hidden = false;
  if (hadFormFocus) processing.focus({ preventScroll: true });
  const [result] = await Promise.all([saveSignup(payload), processingSequence()]);
  const focusProcessing = processing.contains(document.activeElement);
  processing.hidden = true;
  submit.disabled = false;
  if (result.ok) {
    survival = Math.round((0.1 + Math.random() * 6.9) * 10) / 10;
    $('#survival').textContent = `${i18n.format(survival, 1)}%`;
    success.hidden = false;
    if (focusProcessing) success.focus({ preventScroll: true });
    form.reset();
    $('#judgment').hidden = false;
    clearTimeout(judgmentTimer);
    judgmentTimer = setTimeout(() => { $('#judgment').hidden = true; }, motionPaused ? 900 : 1600);
    protocolEvent('accepted');
  } else {
    form.hidden = false;
    showError(result.code);
    if (focusProcessing) submit.focus({ preventScroll: true });
    protocolEvent('error');
  }
  busy = false;
});
$('#return-button').addEventListener('click', () => {
  clearTimeout(judgmentTimer);
  $('#judgment').hidden = true;
  success.hidden = true;
  form.hidden = false;
  $('#steamNick').focus({ preventScroll: true });
  $('#signup').scrollIntoView({ behavior: motionPaused ? 'instant' : 'smooth' });
});

function countUp(element) {
  const end = Number(element.dataset.count);
  const decimals = Number(element.dataset.decimals);
  const start = performance.now();
  function frame(now) {
    const progress = motionPaused ? 1 : Math.min((now - start) / 1600, 1);
    const current = end * (1 - (1 - progress) ** 3);
    element.dataset.current = String(current);
    element.textContent = i18n.format(current, decimals);
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) { countUp(entry.target); observer.unobserve(entry.target); }
}, { threshold: .3 });
document.querySelectorAll('[data-count]').forEach(element => observer.observe(element));
for (let i = 0; i < 24; i++) {
  const dot = document.createElement('i');
  dot.className = 'particle';
  dot.style.left = `${Math.random() * 100}%`;
  dot.style.top = `${Math.random() * 100}%`;
  dot.style.animationDelay = `${-Math.random() * 12}s`;
  $('#particles').append(dot);
}
for (let i = 0; i < 48; i++) {
  const bar = document.createElement('i');
  bar.style.height = `${20 + (i / 48) * 50 + Math.random() * 30}%`;
  bar.style.animationDelay = `${-Math.random() * 3}s`;
  $('.chart').append(bar);
}
setInterval(() => {
  if (document.hidden || motionPaused) return;
  rotationIndex = (rotationIndex + 1) % i18n.t('hero.rotations').length;
  $('#rotating-subtitle').textContent = i18n.t(`hero.rotations.${rotationIndex}`);
  $('#gpu-load').textContent = `${i18n.format(99.95 + Math.random() * .04, 2)}%`;
}, 6000);
document.querySelectorAll('a[href="#terms"], a[href="#privacy"], a[href="#contact"]').forEach(link => link.addEventListener('click', () => { $(link.getAttribute('href')).open = true; }));
if (['#privacy', '#terms', '#contact'].includes(location.hash)) $(location.hash).open = true;
if (location.hash === '#signup') announceSignup();
