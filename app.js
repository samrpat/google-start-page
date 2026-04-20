const STORAGE_KEY = 'orbitStartData';
const DEFAULT_QUOTES = [
  { text: 'Do. Or do not. There is no try.', source: 'Yoda — The Empire Strikes Back' },
  { text: 'In my experience, there is no such thing as luck.', source: 'Obi-Wan Kenobi — A New Hope' },
  { text: 'Never tell me the odds!', source: 'Han Solo — The Empire Strikes Back' },
  { text: 'Your focus determines your reality.', source: 'Qui-Gon Jinn — The Phantom Menace' },
  { text: 'I am one with the Force, and the Force is with me.', source: 'Chirrut Îmwe — Rogue One' },
  { text: 'The Force will be with you. Always.', source: 'Obi-Wan Kenobi — A New Hope' },
];

const state = loadState();
const widgetGrid = document.getElementById('widgetGrid');

init();

function loadState() {
  const fallback = {
    settings: {
      widgetEnabled: { links: true, weather: true, quote: true },
      widgetOrder: ['links', 'weather', 'quote'],
      collapsed: {},
      widgetTitles: {},
      background: 'dusk',
      density: 'spacious',
      city: '',
      quoteIndex: 0,
      quoteLastUpdated: 0,
    },
    links: [
      { id: uid(), label: 'Gmail', url: 'https://mail.google.com' },
      { id: uid(), label: 'YouTube', url: 'https://youtube.com' },
      { id: uid(), label: 'GitHub', url: 'https://github.com' },
    ],
    calendar: [],
    reminders: [],
    quotes: DEFAULT_QUOTES,
  };

  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      ...fallback,
      ...raw,
      settings: { ...fallback.settings, ...(raw.settings || {}) },
      links: Array.isArray(raw.links) ? raw.links : fallback.links,
      quotes: Array.isArray(raw.quotes) && raw.quotes.length ? raw.quotes : fallback.quotes,
      calendar: Array.isArray(raw.calendar) ? raw.calendar : [],
      reminders: Array.isArray(raw.reminders) ? raw.reminders : [],
    };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function init() {
  initClock();
  initSearch();
  initSettings();
  initWidgetDnD();
  initWidgetTitles();
  initQuickLinks();
  initWeather();
  initQuotes();
  renderWidgetsLayout();

  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    }
  });
}

function initClock() {
  const clockEl = document.getElementById('clockDisplay');
  const dateEl = document.getElementById('dateDisplay');
  const greetingEl = document.getElementById('greeting');

  const tick = () => {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    dateEl.textContent = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const h = now.getHours();
    greetingEl.textContent = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  };

  tick();
  setInterval(tick, 1000);
}

function initSearch() {
  const form = document.getElementById('searchForm');
  const input = document.getElementById('searchInput');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;

    const looksLikeUrl = /^(https?:\/\/|localhost|\d+\.\d+\.\d+\.\d+|[\w-]+\.[\w.-]+)/i.test(q);
    if (looksLikeUrl) {
      window.location.href = q.startsWith('http') ? q : `https://${q}`;
    } else {
      window.location.href = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
    }
  });
}

function initSettings() {
  const panel = document.getElementById('settingsPanel');
  document.getElementById('toggleSettings').addEventListener('click', () => panel.classList.toggle('hidden'));

  document.getElementById('bgSelect').value = state.settings.background;
  document.getElementById('densitySelect').value = state.settings.density;

  document.getElementById('bgSelect').addEventListener('change', (e) => {
    state.settings.background = e.target.value;
    applyTheme();
    saveState();
  });

  document.getElementById('densitySelect').addEventListener('change', (e) => {
    state.settings.density = e.target.value;
    applyTheme();
    saveState();
  });

  document.getElementById('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'orbit-start-backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById('importInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== 'object') throw new Error('bad backup');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      location.reload();
    } catch {
      alert('Invalid JSON backup file.');
    }
  });

  renderWidgetToggles();
  applyTheme();
}

function applyTheme() {
  document.body.classList.toggle('compact', state.settings.density === 'compact');
  document.body.classList.remove('bg-aurora', 'bg-ink', 'bg-sunrise');
  if (state.settings.background !== 'dusk') document.body.classList.add(`bg-${state.settings.background}`);
}

function renderWidgetToggles() {
  const names = { links: 'Quick Links', weather: 'Weather', quote: 'Star Wars Quote' };
  const wrap = document.getElementById('widgetToggles');
  wrap.innerHTML = '';

  Object.entries(names).forEach(([key, label]) => {
    const item = document.createElement('label');
    item.innerHTML = `<input type="checkbox" ${state.settings.widgetEnabled[key] ? 'checked' : ''}> ${label}`;
    item.querySelector('input').addEventListener('change', (e) => {
      state.settings.widgetEnabled[key] = e.target.checked;
      saveState();
      renderWidgetsLayout();
    });
    wrap.appendChild(item);
  });
}

function initWidgetDnD() {
  let dragged = null;

  widgetGrid.addEventListener('dragstart', (e) => {
    const widget = e.target.closest('.widget');
    if (!widget) return;
    dragged = widget;
    widget.classList.add('dragging');
  });

  widgetGrid.addEventListener('dragend', () => {
    if (dragged) dragged.classList.remove('dragging');
    [...widgetGrid.children].forEach((el) => el.classList.remove('drop-target'));
    dragged = null;
    persistWidgetOrder();
  });

  widgetGrid.addEventListener('dragover', (e) => {
    e.preventDefault();
    const target = e.target.closest('.widget');
    if (!target || !dragged || target === dragged) return;

    [...widgetGrid.children].forEach((el) => el.classList.remove('drop-target'));
    target.classList.add('drop-target');

    const rect = target.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    widgetGrid.insertBefore(dragged, before ? target : target.nextSibling);
  });

  document.querySelectorAll('.collapse-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.collapse;
      state.settings.collapsed[key] = !state.settings.collapsed[key];
      saveState();
      renderWidgetsLayout();
    });
  });
}

function persistWidgetOrder() {
  state.settings.widgetOrder = [...widgetGrid.children].map((w) => w.dataset.widget);
  saveState();
}

function renderWidgetsLayout() {
  const map = Object.fromEntries([...widgetGrid.children].map((el) => [el.dataset.widget, el]));

  state.settings.widgetOrder.forEach((key) => {
    if (map[key]) widgetGrid.appendChild(map[key]);
  });

  [...widgetGrid.children].forEach((widget) => {
    const key = widget.dataset.widget;
    widget.style.display = state.settings.widgetEnabled[key] ? '' : 'none';
    widget.classList.toggle('collapsed', Boolean(state.settings.collapsed[key]));
    widget.querySelector('.collapse-btn').textContent = state.settings.collapsed[key] ? '+' : '−';
  });
}

function initWidgetTitles() {
  document.querySelectorAll('[data-widget-title]').forEach((titleEl) => {
    const key = titleEl.dataset.widgetTitle;
    if (state.settings.widgetTitles[key]) titleEl.textContent = state.settings.widgetTitles[key];

    titleEl.addEventListener('blur', () => {
      state.settings.widgetTitles[key] = titleEl.textContent.trim() || titleEl.dataset.widgetTitle;
      saveState();
    });
  });
}

function initQuickLinks() {
  const form = document.getElementById('linkForm');
  const labelEl = document.getElementById('linkLabel');
  const urlEl = document.getElementById('linkUrl');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const label = labelEl.value.trim();
    const url = urlEl.value.trim();
    if (!label || !url) return;

    state.links.push({ id: uid(), label, url });
    form.reset();
    saveState();
    renderLinks();
  });

  renderLinks();
}

function renderLinks() {
  const list = document.getElementById('linksList');
  list.innerHTML = '';

  state.links.forEach((link, idx) => {
    const hostname = safeHostname(link.url);
    const badge = hostname ? hostname.charAt(0).toUpperCase() : '•';
    const li = document.createElement('li');
    li.innerHTML = `
      <a href="${escapeHtml(link.url)}" target="_self">
        <span class="link-badge">${badge}</span>
        <span>${escapeHtml(link.label)}</span>
      </a>
      <div class="actions">
        <button data-act="up">↑</button>
        <button data-act="down">↓</button>
        <button data-act="edit">Edit</button>
        <button data-act="del">Delete</button>
      </div>
    `;

    li.querySelector('[data-act="up"]').addEventListener('click', () => swap(state.links, idx, idx - 1));
    li.querySelector('[data-act="down"]').addEventListener('click', () => swap(state.links, idx, idx + 1));
    li.querySelector('[data-act="edit"]').addEventListener('click', () => {
      const label = prompt('Label', link.label);
      const url = prompt('URL', link.url);
      if (!label || !url) return;
      link.label = label.trim();
      link.url = url.trim();
      saveState();
      renderLinks();
    });
    li.querySelector('[data-act="del"]').addEventListener('click', () => {
      state.links = state.links.filter((x) => x.id !== link.id);
      saveState();
      renderLinks();
    });

    list.appendChild(li);
  });
}

function swap(arr, i, j) {
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  saveState();
  renderLinks();
}

async function initWeather() {
  document.getElementById('weatherLocationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const city = document.getElementById('cityInput').value.trim();
    if (!city) return;
    state.settings.city = city;
    saveState();
    await fetchWeatherByCity(city);
  });

  document.getElementById('geoBtn').addEventListener('click', () => {
    if (!navigator.geolocation) return setWeatherStatus('Geolocation unavailable.');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => fetchWeatherByCoords(coords.latitude, coords.longitude, 'Your location'),
      () => setWeatherStatus('Location access denied.')
    );
  });

  if (state.settings.city) {
    await fetchWeatherByCity(state.settings.city);
  } else {
    document.getElementById('geoBtn').click();
  }
}

function setWeatherStatus(msg) {
  document.getElementById('weatherStatus').textContent = msg;
}

async function fetchWeatherByCity(city) {
  try {
    setWeatherStatus(`Locating ${city}…`);
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
    const geo = await geoRes.json();
    const place = geo.results?.[0];
    if (!place) return setWeatherStatus('City not found.');
    await fetchWeatherByCoords(place.latitude, place.longitude, `${place.name}, ${place.country_code}`);
  } catch {
    setWeatherStatus('Could not load city weather.');
  }
}

async function fetchWeatherByCoords(lat, lon, label) {
  try {
    setWeatherStatus(`Weather for ${label}`);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`;
    const res = await fetch(url);
    const data = await res.json();

    document.getElementById('weatherNow').innerHTML = `
      <strong>${label}</strong>
      <div class="temp">${Math.round(data.current.temperature_2m)}°C</div>
      <div>${weatherLabel(data.current.weather_code)}</div>
      <div class="subtle">Wind ${Math.round(data.current.wind_speed_10m)} km/h</div>
    `;

    const forecast = document.getElementById('forecastList');
    forecast.innerHTML = '';
    data.daily.time.slice(0, 4).forEach((day, i) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <strong>${new Date(day).toLocaleDateString([], { weekday: 'short' })}</strong>
        <div>${Math.round(data.daily.temperature_2m_min[i])}° / ${Math.round(data.daily.temperature_2m_max[i])}°</div>
        <div class="subtle">${weatherLabel(data.daily.weather_code[i])}</div>
      `;
      forecast.appendChild(li);
    });
  } catch {
    setWeatherStatus('Weather unavailable right now.');
  }
}

function weatherLabel(code) {
  if (code === 0) return 'Clear';
  if ([1, 2, 3].includes(code)) return 'Cloudy';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Storm';
  return 'Mixed';
}

function initQuotes() {
  const ROTATE_MS = 1000 * 60 * 30;
  const now = Date.now();

  if (!state.settings.quoteLastUpdated || now - state.settings.quoteLastUpdated > ROTATE_MS) {
    state.settings.quoteIndex = Math.floor(Math.random() * state.quotes.length);
    state.settings.quoteLastUpdated = now;
    saveState();
  }

  renderQuote();
  document.getElementById('nextQuoteBtn').addEventListener('click', nextQuote);
  setInterval(nextQuote, ROTATE_MS);
}

function nextQuote() {
  state.settings.quoteIndex = (state.settings.quoteIndex + 1) % state.quotes.length;
  state.settings.quoteLastUpdated = Date.now();
  saveState();
  renderQuote();
}

function renderQuote() {
  const quote = state.quotes[state.settings.quoteIndex] || DEFAULT_QUOTES[0];
  const quoteEl = document.getElementById('quoteText');
  quoteEl.style.opacity = '0';
  setTimeout(() => {
    quoteEl.textContent = `“${quote.text}”`;
    document.getElementById('quoteMeta').textContent = quote.source || '';
    quoteEl.style.opacity = '1';
  }, 170);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeHostname(url) {
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    return new URL(normalized).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
