// Mood discovery uses the storefront's existing search and category filters.
(() => {
  const search = document.getElementById('perfumeSearch');
  const category = document.getElementById('categoryFilter');
  const catalog = document.getElementById('perfumes');
  const status = document.getElementById('moodStatus');
  if (!search || !category || !catalog) return;
  document.querySelectorAll('[data-mood]').forEach(button => {
    button.addEventListener('click', () => {
      category.value = 'all';
      category.dispatchEvent(new Event('change', { bubbles: true }));
      search.value = button.dataset.mood;
      search.dispatchEvent(new Event('input', { bubbles: true }));
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      catalog.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' });
      document.querySelectorAll('[data-mood]').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
      status.textContent = button.dataset.mood ? `Showing ${button.textContent.trim().toLowerCase()} scents.` : 'Showing all scents.';
      search.focus({ preventScroll: true });
    });
  });
  search.addEventListener('input', () => {
    document.querySelectorAll('[data-mood]').forEach(choice => choice.setAttribute('aria-pressed', String(choice.dataset.mood === search.value.toLowerCase())));
    status.textContent = '';
  });
  document.getElementById('clearFilters')?.addEventListener('click', () => {
    document.querySelectorAll('[data-mood]').forEach(choice => choice.setAttribute('aria-pressed', String(choice.dataset.mood === '')));
    status.textContent = '';
  });
})();

(() => {
  const track = document.getElementById('perfumeGrid');
  const previous = document.getElementById('carouselPrev');
  const next = document.getElementById('carouselNext');
  const position = document.getElementById('carouselPosition');
  const empty = document.getElementById('carouselEmpty');
  if (!track || !previous || !next) return;

  function updateControls() {
    const cards = [...track.querySelectorAll('.perfume-card')];
    const bounds = track.getBoundingClientRect();
    const visible = cards.map((card, index) => ({ bounds: card.getBoundingClientRect(), index }))
      .filter(card => Math.min(card.bounds.right, bounds.right) - Math.max(card.bounds.left, bounds.left) > card.bounds.width / 2);
    previous.disabled = track.scrollLeft <= 2;
    next.disabled = !cards.length || track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
    empty.hidden = cards.length > 0;
    const label = visible.length ? `${visible[0].index + 1}–${visible[visible.length - 1].index + 1} of ${cards.length} fragrances` : `${cards.length} fragrances`;
    if (position.textContent !== label) position.textContent = label;
  }

  function advance(direction) {
    const card = track.querySelector('.perfume-card');
    if (!card) return;
    const step = card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).gap);
    track.scrollBy({ left: direction * step, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  function refresh() {
    track.scrollTo({ left: 0, behavior: 'instant' });
    track.querySelectorAll('.perfume-card').forEach((card, index) => {
      card.dataset.galleryIndex = String(index + 1).padStart(2, '0');
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `View ${card.dataset.name} perfume details`);
    });
    updateControls();
  }

  previous.addEventListener('click', () => advance(-1));
  next.addEventListener('click', () => advance(1));
  track.addEventListener('scroll', updateControls, { passive: true });
  track.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      advance(event.key === 'ArrowLeft' ? -1 : 1);
    } else if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.perfume-card')) {
      event.preventDefault();
      event.target.click();
    }
  });
  new MutationObserver(refresh).observe(track, { childList: true });
  new ResizeObserver(updateControls).observe(track);
  refresh();
})();

// The gallery spotlight follows the fragrance at the start of the filmstrip.
(() => {
  const track = document.getElementById('perfumeGrid');
  const stage = document.getElementById('fragranceStage');
  const selector = document.getElementById('gallerySelector');
  const range = document.getElementById('galleryRange');
  if (!track || !stage || !range) return;
  const name = document.getElementById('stageName');
  const image = document.getElementById('stageImage');
  const brand = document.getElementById('stageBrand');
  const family = document.getElementById('stageFamily');
  const tags = document.getElementById('stageTags');
  const price = document.getElementById('stagePrice');
  const indexLabel = document.getElementById('stageIndex');
  const rangeLabel = document.getElementById('galleryRangeLabel');
  let selectedCard = null;
  let frame = null;
  const number = value => String(value).padStart(2, '0');

  function show(card, index, total) {
    const perfume = (window.perfumesData || []).find(item => item.Name === card.dataset.name);
    if (!perfume) return;
    range.value = index + 1;
    range.max = total;
    range.setAttribute('aria-valuetext', `${perfume.Name}, fragrance ${index + 1} of ${total}`);
    indexLabel.textContent = rangeLabel.textContent = `${number(index + 1)} / ${number(total)}`;
    if (selectedCard === card) return;
    selectedCard?.classList.remove('gallery-active');
    selectedCard = card;
    card.classList.add('gallery-active');
    name.textContent = perfume.Name;
    brand.textContent = perfume.Brand;
    family.textContent = perfume.Category.replaceAll('/', ' / ');
    price.textContent = `₱${perfume.SellingPrice}`;
    image.src = perfume.ImagePath || 'images/scnt_default.png';
    image.alt = `${perfume.Name} by SCNT Vault`;
    const category = perfume.Category.toLowerCase();
    stage.dataset.family = category.includes('fresh') || category.includes('aquatic') ? 'fresh' : category.includes('floral') ? 'floral' : category.includes('gourmand') || category.includes('sweet') ? 'sweet' : 'woody';
    tags.replaceChildren(...[perfume.Gender, perfume.Size.trim().replace(/[,/\s]+$/, ''), 'Oil-based'].map(text => {
      const tag = document.createElement('span');
      tag.textContent = text;
      return tag;
    }));
  }

  function update() {
    frame = null;
    const cards = [...track.querySelectorAll('.perfume-card')];
    stage.hidden = selector.hidden = !cards.length;
    if (!cards.length) { selectedCard = null; return; }
    const first = cards[0].getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(track).gap);
    const index = Math.min(cards.length - 1, Math.round(track.scrollLeft / (first.width + gap)));
    show(cards[index], index, cards.length);
  }
  function schedule() { if (frame === null) frame = requestAnimationFrame(update); }
  range.addEventListener('input', () => {
    const cards = [...track.querySelectorAll('.perfume-card')];
    const index = Number(range.value) - 1;
    if (!cards[index]) return;
    const step = cards[0].getBoundingClientRect().width + parseFloat(getComputedStyle(track).gap);
    track.scrollTo({ left: step * index, behavior: 'instant' });
    show(cards[index], index, cards.length);
  });
  document.getElementById('stageDetails').addEventListener('click', () => selectedCard?.click());
  track.addEventListener('scroll', schedule, { passive: true });
  new MutationObserver(() => { selectedCard = null; schedule(); }).observe(track, { childList: true });
  new ResizeObserver(schedule).observe(track);
  update();
})();
