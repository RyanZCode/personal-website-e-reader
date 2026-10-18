import { mergeRects, changedTextRects, tailRect } from './ink-regions.mjs';
const quotes = [
  { text: 'Be the change that you wish to see in the world.' },
  { text: '80% of success is showing up.' },
  { text: 'A journey of a thousand miles starts with a single step.' },
  { text: 'A moving man will eventually meet his luck.' },
  { text: 'Do or do not. There is no try.' },
  { text: 'It ain’t about how hard you hit. It’s about how hard you can get hit and keep moving forward.' },
  { text: 'I didn’t hear no bell.' },
  { text: 'A smooth sea never made a skilled sailor.' },
  { text: 'Choose discipline over motivation and consistency over perfection.' },
  { text: 'Some people land on high ground. Others have to build up.' },
];
let inkEffects = true;
try { inkEffects = localStorage.getItem('ink-effects') !== 'off'; } catch {  }
const display = document.querySelector('.display');
const pauseButton = document.querySelector('#pause-quotes');
const nextButton = document.querySelector('#next-quote');
const quoteText = document.querySelector('#quote-text');
const quotePosition = document.querySelector('#quote-position');
const quoteCaption = document.querySelector('.quote-caption');
const quoteDisplay = document.querySelector('#quote-display');
const quoteContent = document.querySelector('.quote-content');
const clock = document.querySelector('#clock');
const experience = document.querySelector('#experience');
const pending = new Map();
let rendering = false;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function pageRect(rect) {
  return { left: rect.left + scrollX, top: rect.top + scrollY, width: rect.width, height: rect.height };
}
function elementRect(element) { return pageRect(element.getBoundingClientRect()); }
function textSnapshot(element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let text = '';
  const boxes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    for (let i = 0; i < node.length; i++) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      text += node.data[i];
      boxes.push(Array.from(range.getClientRects(), pageRect));
    }
  }
  return { text, boxes };
}
function textRegion(elements, extra = () => [], textOptions = {}) {
  return { anchor: elements[0], mode: 'partial',
    snapshot: () => ({ texts: elements.map(textSnapshot), rects: extra() }),
    dirty: (before, after) => mergeRects([
      ...before.texts.flatMap((old, i) => changedTextRects(old, after.texts[i], textOptions)),
      ...before.rects, ...after.rects,
    ]),
  };
}
function controlInkRects(button, includeIcon = true) {
  const rects = includeIcon ? Array.from(button.querySelectorAll('svg'), elementRect).filter(r => r.width && r.height) : [];
  if (button.matches('[aria-pressed="true"], .ink-clicked')) {
    const bounds = elementRect(button);
    rects.push({ left: bounds.left + 7, top: bounds.top + bounds.height - 2, width: bounds.width - 14, height: 2 });
  }
  return rects;
}
function controlRegion(button, includeIcon = true) {
  return { anchor: button, mode: 'partial', snapshot: () => controlInkRects(button, includeIcon),
    dirty: (before, after) => mergeRects([...before, ...after]) };
}
const experienceRegion = {
  anchor: display, mode: 'partial',
  snapshot: () => [tailRect(elementRect(display), elementRect(experience.querySelector('summary')))],
  dirty: (before, after) => mergeRects([...before, ...after]),
};
function regionSpec(target) {
  return target instanceof Element ? {
    anchor: target, mode: target === display ? 'full' : 'local',
    snapshot: () => [elementRect(target)], dirty: (before, after) => mergeRects([...before, ...after]),
  } : target;
}

function refreshInk(target, update, key = target, shouldUpdate = () => true) {
  return new Promise(resolve => {
    const previous = pending.get(key);
    if (previous) previous.resolve(false);
    pending.set(key, { region: regionSpec(target), update, shouldUpdate, resolve });
    void flushInk();
  });
}
async function flushInk() {
  if (rendering) return;
  rendering = true;
  try {
    while (pending.size) {
      const [key, job] = pending.entries().next().value;
      pending.delete(key);
      if (!job.shouldUpdate()) { job.resolve(false); continue; }
      const animate = inkEffects && !document.hidden;
      const before = animate ? job.region.snapshot() : null;
      job.update();
      if (!animate) { job.resolve(true); continue; }
      const after = job.region.snapshot();
      const dirty = job.region.dirty(before, after);

      const films = dirty.map(rect => {
        const film = document.createElement('div');
        film.className = 'ink-film';
        film.dataset.mode = job.region.mode;
        film.dataset.phase = job.region.mode === 'full' ? 'clear' : job.region.mode === 'local' ? 'invert' : 'transfer';
        film.setAttribute('aria-hidden', 'true');
        film.inert = true;
        film.style.width = `${rect.width}px`;
        film.style.height = `${rect.height}px`;
        document.body.append(film);
        return { film, rect };
      });
      const position = () => films.forEach(({ film, rect }) => {
        film.style.left = `${rect.left - scrollX}px`;
        film.style.top = `${rect.top - scrollY}px`;
      });
      position();
      window.addEventListener('scroll', position, true);
      const setPhase = phase => films.forEach(({ film }) => { film.dataset.phase = phase; });
      try {
        if (films.length) {
          if (job.region.mode === 'full') {
            await delay(50); setPhase('paper');
            await delay(50); setPhase('residual');
            await delay(50); setPhase('settled');
            await delay(50);
          } else if (job.region.mode === 'local') {
            await delay(60); setPhase('clear');
            await delay(45); setPhase('settled');
            await delay(55);
          } else {
            await delay(55); setPhase('residual');
            await delay(45); setPhase('settled');
            await delay(50);
          }
        }
      } finally {
        window.removeEventListener('scroll', position, true);
        films.forEach(({ film }) => film.remove());
      }
      job.resolve(true);
    }
  } finally { rendering = false; }
}

const palettes = ['night', 'paper'];
function applyPalette(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('[data-theme-choice]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
  });
  document.querySelector('meta[name="theme-color"]').content = {
    night: '#282b27', paper: '#e7e6dd',
  }[theme];
}
let initialTheme = 'paper';
try {
  const saved = localStorage.getItem('ink-palette');
  if (palettes.includes(saved)) initialTheme = saved;
  else if (saved === 'slate' || saved === 'light') {
    initialTheme = 'paper';
    localStorage.setItem('ink-palette', 'paper');
  }
} catch {  }
applyPalette(initialTheme);
document.querySelectorAll('[data-theme-choice]').forEach(button => {
  button.addEventListener('click', () => {
    const theme = button.dataset.themeChoice;
    void refreshInk(display, () => {
      applyPalette(theme);
      try { localStorage.setItem('ink-palette', theme); } catch {  }
    }, 'palette', () => document.documentElement.dataset.theme !== theme);
  });
});

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric', minute: '2-digit', hour12: true,
});
function renderClock() {
  const now = new Date();
  clock.textContent = timeFormatter.format(now);
  clock.dateTime = now.toISOString();
}
let clockTimer;
function scheduleClock() {
  clearTimeout(clockTimer);
  const now = new Date();
  if (clock.textContent !== timeFormatter.format(now)) {
    void refreshInk(textRegion([clock]), renderClock, 'clock', () => clock.textContent !== timeFormatter.format(new Date()));
  }
  clockTimer = setTimeout(scheduleClock, 60000 - (Date.now() % 60000) + 30);
}
renderClock();
scheduleClock();

let desiredExperienceOpen = false;
experience.querySelector('summary').addEventListener('click', event => {
  event.preventDefault();
  desiredExperienceOpen = !desiredExperienceOpen;
  void refreshInk(experienceRegion, () => {
    experience.open = desiredExperienceOpen;
  }, 'experience', () => experience.open !== desiredExperienceOpen);
});

let quoteIndex = 0;
let paused = false;
let desiredPaused = false;
let quotePending = false;
let rotationTimer;
let nextClickTimer;
let measuredQuoteWidth = 0;
function sizeQuoteDisplay(force = false) {
  const width = quoteDisplay.getBoundingClientRect().width;
  if (!width || (!force && width === measuredQuoteWidth)) return;
  measuredQuoteWidth = width;
  const sample = quoteContent.cloneNode(true);
  sample.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
  sample.setAttribute('aria-hidden', 'true');
  sample.inert = true;
  Object.assign(sample.style, { position: 'fixed', left: '-10000px', top: '0', width: `${width}px`, visibility: 'hidden', minHeight: '' });
  document.body.append(sample);
  const text = sample.querySelector('p');
  const caption = sample.querySelector('.quote-caption');
  const counter = caption.querySelector('span:last-child');
  let height = 0;
  for (const [index, quote] of quotes.entries()) {
    text.textContent = quote.text;
    caption.firstChild.textContent = quote.author ? `${quote.author} ` : 'MY FAVOURITE QUOTES ';
    counter.textContent = `${String(index + 1).padStart(2, '0')} OF ${String(quotes.length).padStart(2, '0')}`;
    height = Math.max(height, sample.getBoundingClientRect().height);
  }
  sample.remove();
  quoteContent.style.minHeight = `${Math.ceil(height)}px`;
}
new ResizeObserver(() => sizeQuoteDisplay()).observe(quoteDisplay);
document.fonts.ready.then(() => sizeQuoteDisplay(true));
function renderQuote() {
  const quote = quotes[quoteIndex];
  quoteText.textContent = quote.text;
  quoteCaption.firstChild.textContent = quote.author ? `${quote.author} ` : 'MY FAVOURITE QUOTES ';
  quotePosition.textContent = `${String(quoteIndex + 1).padStart(2, '0')} OF ${String(quotes.length).padStart(2, '0')}`;
}
function scheduleRotation() {
  clearTimeout(rotationTimer);
  if (!desiredPaused && !document.hidden && !quotePending) rotationTimer = setTimeout(() => nextQuote(false), 10000);
}
async function nextQuote(manual = true) {
  if (quotePending) return;
  quotePending = true;
  clearTimeout(rotationTimer);
  try {
    await refreshInk(textRegion([quoteText, quoteCaption], () => manual ? controlInkRects(nextButton, false) : [], { groupDigits: true }), () => {
      if (manual) {
        nextButton.classList.add('ink-clicked');
        clearTimeout(nextClickTimer);
        nextClickTimer = setTimeout(() => {
          void refreshInk(controlRegion(nextButton, false), () => nextButton.classList.remove('ink-clicked'), 'next-feedback',
            () => nextButton.classList.contains('ink-clicked'));
        }, 180);
      }
      quoteIndex = (quoteIndex + 1) % quotes.length;
      renderQuote();
    }, 'quote', () => manual || (!desiredPaused && !document.hidden));
  } finally {
    quotePending = false;
    scheduleRotation();
  }
}
pauseButton.addEventListener('click', () => {
  desiredPaused = !desiredPaused;
  clearTimeout(rotationTimer);
  void refreshInk(controlRegion(pauseButton), () => {
    paused = desiredPaused;
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.setAttribute('aria-label', paused ? 'Resume quote rotation' : 'Pause quote rotation');
    scheduleRotation();
  }, 'pause', () => paused !== desiredPaused).then(scheduleRotation);
});
nextButton.addEventListener('click', () => void nextQuote());
document.addEventListener('visibilitychange', () => { scheduleClock(); scheduleRotation(); });

document.querySelectorAll('a, button, summary').forEach(control => {
  let hovered = false;
  let focused = false;
  const changed = () =>
    control.classList.contains('ink-hover') !== hovered ||
    control.classList.contains('ink-focus') !== focused;
  const commit = () => {
    control.classList.toggle('ink-hover', hovered);
    control.classList.toggle('ink-focus', focused);
  };
  const queue = () => void refreshInk(control, commit, control, changed);
  control.addEventListener('pointerenter', event => {
    if (event.pointerType === 'touch') return;
    hovered = true; queue();
  });
  control.addEventListener('pointerleave', () => { hovered = false; queue(); });
  control.addEventListener('focus', () => { focused = control.matches(':focus-visible'); queue(); });
  control.addEventListener('blur', () => { focused = false; queue(); });
});

const effectsButton = document.querySelector('#ink-effects');
function renderEffectsSetting() {
  effectsButton.setAttribute('aria-pressed', String(inkEffects));
  effectsButton.querySelector('span').textContent = inkEffects ? 'ON' : 'OFF';
}
effectsButton.addEventListener('click', () => {
  void refreshInk(textRegion([effectsButton.querySelector('span')]), () => {
    inkEffects = !inkEffects;
    renderEffectsSetting();
    try { localStorage.setItem('ink-effects', inkEffects ? 'on' : 'off'); } catch {  }
  }, 'effects');
});
renderEffectsSetting();
renderQuote();
scheduleRotation();
