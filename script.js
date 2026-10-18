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

const pauseButton = document.querySelector('#pause-quotes');
const nextButton = document.querySelector('#next-quote');
const quoteText = document.querySelector('#quote-text');
const quotePosition = document.querySelector('#quote-position');
const quoteCaption = document.querySelector('.quote-caption');
const quoteDisplay = document.querySelector('#quote-display');
const quoteContent = document.querySelector('.quote-content');
const clock = document.querySelector('#clock');
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
} catch { }
applyPalette(initialTheme);
document.querySelectorAll('[data-theme-choice]').forEach(button => {
  button.addEventListener('click', () => {
    const theme = button.dataset.themeChoice;
    applyPalette(theme);
    try { localStorage.setItem('ink-palette', theme); } catch { }
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
  renderClock();
  clockTimer = setTimeout(scheduleClock, 60000 - (Date.now() % 60000) + 30);
}
scheduleClock();

let quoteIndex = 0;
let paused = false;
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
  if (!paused && !document.hidden) rotationTimer = setTimeout(() => nextQuote(false), 10000);
}
function nextQuote(manual = true) {
  clearTimeout(rotationTimer);
  if (manual) {
    nextButton.classList.add('ink-clicked');
    clearTimeout(nextClickTimer);
    nextClickTimer = setTimeout(() => nextButton.classList.remove('ink-clicked'), 180);
  }
  quoteIndex = (quoteIndex + 1) % quotes.length;
  renderQuote();
  scheduleRotation();
}
pauseButton.addEventListener('click', () => {
  paused = !paused;
  pauseButton.setAttribute('aria-pressed', String(paused));
  pauseButton.setAttribute('aria-label', paused ? 'Resume quote rotation' : 'Pause quote rotation');
  scheduleRotation();
});
nextButton.addEventListener('click', () => nextQuote());
document.addEventListener('visibilitychange', () => { scheduleClock(); scheduleRotation(); });
renderQuote();
scheduleRotation();
