const layer = document.getElementById('icon-layer');
const bgEl = document.getElementById('background');
const bgCanvas = document.getElementById('bg-canvas');
const contextMenu = document.getElementById('context-menu');
const drawerEl = document.getElementById('drawer');
const onboardingEl = document.getElementById('onboarding');
const dockEl = document.getElementById('dock');

let config = null;
let editMode = false;
let editingIconId = null;
let openGroupId = null; // 현재 펼쳐진 그룹
const selected = new Set(); // 편집 모드에서 선택된 아이콘 id

// ── 배경 프리셋 (macOS 시리즈) ──────────────────────────

const BG_PRESETS = {
  sonoma: {
    value: 'radial-gradient(130% 130% at 20% 0%, #ffb37b 0%, #ff5e62 30%, #7a4ccf 65%, #2b0a4d 100%)',
    flow: true,
  },
  sequoia: {
    value: 'radial-gradient(140% 140% at 80% 0%, #8fd8ff 0%, #4a7bd0 45%, #274060 100%)',
    flow: true,
  },
  mojave: {
    value: 'linear-gradient(180deg, #f8b500 0%, #e8590c 35%, #7a2e6f 70%, #1a1035 100%)',
    flow: false,
  },
  aurora: {
    value: 'radial-gradient(120% 120% at 50% 0%, #0f4c5c 0%, #123a5c 45%, #060d1f 100%)',
    flow: true,
  },
};

// ── 기본 테마 ───────────────────────────────────────────

const THEME_EMOJIS = ['🐱', '🌟', '🎮', '🦊', '🎵', '💎', '🌸', '⭐', '🐶', '🚀', '🍀', '🎨', '🦄', '🌙', '🍓', '👾'];

// Fluent Emoji 3D 에셋 매핑 (MIT, microsoft/fluentui-emoji)
const EMOJI_ASSETS = {
  '🐱': 'assets/emoji/cat_face_3d.png',
  '🌟': 'assets/emoji/glowing_star_3d.png',
  '🎮': 'assets/emoji/video_game_3d.png',
  '🦊': 'assets/emoji/fox_3d.png',
  '🎵': 'assets/emoji/musical_note_3d.png',
  '💎': 'assets/emoji/gem_stone_3d.png',
  '🌸': 'assets/emoji/cherry_blossom_3d.png',
  '⭐': 'assets/emoji/star_3d.png',
  '🐶': 'assets/emoji/dog_face_3d.png',
  '🚀': 'assets/emoji/rocket_3d.png',
  '🍀': 'assets/emoji/four_leaf_clover_3d.png',
  '🎨': 'assets/emoji/artist_palette_3d.png',
  '🦄': 'assets/emoji/unicorn_3d.png',
  '🌙': 'assets/emoji/crescent_moon_3d.png',
  '🍓': 'assets/emoji/strawberry_3d.png',
  '👾': 'assets/emoji/alien_monster_3d.png',
  '📁': 'assets/emoji/file_folder_3d.png',
  '📦': 'assets/emoji/package_3d.png',
  '🗑️': 'assets/emoji/wastebasket_3d.png',
};

// 이모지 → Fluent Emoji 3D 이미지 노드 (에셋 없으면 텍스트 폴백)
function emojiNode(emoji) {
  const asset = EMOJI_ASSETS[emoji];
  if (asset) {
    const img = document.createElement('img');
    img.src = asset;
    img.draggable = false;
    img.className = 'emoji-img';
    return img;
  }
  return document.createTextNode(emoji);
}
const DEFAULT_GRADIENT = 'linear-gradient(160deg, #667eea 0%, #764ba2 100%)';
const TYPE_LABELS = { exe: '프로그램', folder: '폴더', url: 'URL' };
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

// ── 유틸 ────────────────────────────────────────────────

function fileUrl(p) {
  return 'file:///' + encodeURI(p.replace(/\\/g, '/'));
}

function uid() {
  return 'icon-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

function save() {
  window.customizer.saveConfig(config);
}

function findIcon(id) {
  return config.icons.find((i) => i.id === id);
}

// 화면 크기에 맞춘 자동 그리드 좌표 (세로로 채우고 다음 칸으로)
function placeGrid(count, size = 96) {
  const cellW = size + 50;
  const cellH = size + 60;
  const cols = Math.max(1, Math.floor((window.innerWidth - 140) / cellW));
  const out = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    out.push({ x: 80 + col * cellW, y: 80 + row * cellH });
  }
  return out;
}

function clearSelection() {
  selected.clear();
  document.querySelectorAll('.icon.selected').forEach((el) => el.classList.remove('selected'));
}

// ── 렌더링 ──────────────────────────────────────────────

function renderIcon(icon) {
  const isGroup = icon.type === 'group';
  const el = document.createElement('div');
  el.className = 'icon interactive' + (isGroup ? ' group' : '');
  if (selected.has(icon.id)) el.classList.add('selected');
  el.dataset.id = icon.id;
  el.style.left = icon.x + 'px';
  el.style.top = icon.y + 'px';

  const imgBox = document.createElement('div');
  imgBox.className = 'icon-image';
  const displaySize = icon.size * themeIconFactor();
  imgBox.style.width = displaySize + 'px';
  imgBox.style.height = displaySize + 'px';
  // 이모지 크기를 아이콘 크기에 비례 (64px @ 96px 기준)
  imgBox.style.fontSize = Math.round(displaySize * 0.66) + 'px';

  // 회전은 inner에 적용 (bounce 애니메이션과 충돌 방지)
  const inner = document.createElement('div');
  inner.className = 'icon-inner';
  if (icon.rotation) inner.style.transform = `rotate(${icon.rotation}deg)`;

  const src = icon.image || icon.iconData;
  if (src) {
    const img = document.createElement('img');
    img.src = src.startsWith('data:') ? src : fileUrl(src);
    img.draggable = false;
    inner.appendChild(img);
  } else {
    inner.appendChild(emojiNode(icon.emoji || (isGroup ? '📁' : '📦')));
  }

  imgBox.appendChild(inner);

  const name = document.createElement('div');
  name.className = 'icon-name';
  name.textContent = icon.name;

  el.appendChild(imgBox);
  el.appendChild(name);

  if (isGroup) {
    const badge = document.createElement('div');
    badge.className = 'group-badge';
    badge.textContent = icon.items.length;
    el.appendChild(badge);
  }

  // 크기/회전 핸들 (편집 모드에서 선택 시 표시)
  const handle = document.createElement('div');
  handle.className = 'resize-handle';
  el.appendChild(handle);

  const rotateHandle = document.createElement('div');
  rotateHandle.className = 'rotate-handle';
  el.appendChild(rotateHandle);

  layer.appendChild(el);
  attachIconEvents(el, icon, handle, rotateHandle);
}

function renderAll() {
  // macOS 테마: 기존 아이콘이 Dock 영역에 걸치면 위로 보정
  if (config.theme === 'macos') {
    config.icons.forEach((ic) => {
      const maxY = window.innerHeight - 110 - ic.size * themeIconFactor();
      ic.y = Math.max(0, Math.min(ic.y, maxY));
    });
  }
  renderBackground();
  renderDock();
  hideDrawer();
  layer.innerHTML = '';
  config.icons.forEach(renderIcon);
}

// ── 배경 렌더링 ─────────────────────────────────────────

function renderBackground() {
  const bg = config.background;
  if (bg?.type === 'image' && bg.path) {
    bgCanvas.style.backgroundImage = `url("${fileUrl(bg.path)}")`;
  } else if (bg?.type === 'gradient' && bg.value) {
    bgCanvas.style.backgroundImage = bg.value;
  } else {
    bgCanvas.style.backgroundImage = 'none';
  }
  bgEl.classList.toggle('flow', !!bg?.flow);
}

// ── 테마 ────────────────────────────────────────────────

// 스퀘클(초타원, n=5) SVG 마스크 생성 → CSS 변수로 주입
function injectSquircleMask() {
  const n = 5;
  const size = 100;
  const steps = 128;
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = size / 2 + (size / 2) * Math.sign(c) * Math.abs(c) ** (2 / n);
    const y = size / 2 + (size / 2) * Math.sign(s) * Math.abs(s) ** (2 / n);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${size} ${size}' preserveAspectRatio='none'>` +
    `<polygon points='${pts.join(' ')}' fill='black'/></svg>`;
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  document.documentElement.style.setProperty('--squircle', `url("${url}")`);
}

function applyTheme() {
  const macos = config.theme === 'macos';
  document.body.classList.toggle('theme-macos', macos);
  renderAll();
  updateThemeMenuMarks();
}

// 테마별 아이콘 표시 배율 (macOS는 기본 아이콘이 작음)
function themeIconFactor() {
  return config.theme === 'macos' ? 0.7 : 1;
}

function updateThemeMenuMarks() {
  const isMacos = config.theme === 'macos';
  document.getElementById('menu-theme-default').textContent =
    (isMacos ? '' : '✓ ') + '테마: 기본';
  document.getElementById('menu-theme-macos').textContent =
    (isMacos ? '✓ ' : '') + '테마: macOS';
}

// ── Dock (macOS 테마) ───────────────────────────────────

const DOCK_ICON_SIZE = 60;
const dockTip = document.createElement('div');
dockTip.className = 'dock-tip hidden';
document.body.appendChild(dockTip);

function renderDock() {
  dockEl.innerHTML = '';
  hideDockTip();
  if (config.theme !== 'macos') {
    dockEl.classList.add('hidden');
    return;
  }
  dockEl.classList.remove('hidden');

  config.dock.items.forEach((item) => {
    dockEl.appendChild(dockItemEl(item));
  });

  // 우측: 구분선 + 휴지통
  const sep = document.createElement('div');
  sep.className = 'dock-sep';
  dockEl.appendChild(sep);

  const trash = document.createElement('div');
  trash.className = 'dock-item';
  const trashBox = document.createElement('div');
  trashBox.className = 'dock-icon';
  trashBox.style.width = DOCK_ICON_SIZE + 'px';
  trashBox.style.height = DOCK_ICON_SIZE + 'px';
  trashBox.appendChild(emojiNode('🗑️'));
  trash.appendChild(trashBox);
  trash.addEventListener('click', () => {
    window.customizer.openTarget('shell:RecycleBinFolder', 'url');
  });
  dockEl.appendChild(trash);
}

function dockItemEl(item) {
  const wrap = document.createElement('div');
  wrap.className = 'dock-item interactive';

  const box = document.createElement('div');
  box.className = 'dock-icon';
  box.style.width = DOCK_ICON_SIZE + 'px';
  box.style.height = DOCK_ICON_SIZE + 'px';
  const src = item.image || item.iconData;
  if (src) {
    const img = document.createElement('img');
    img.src = src.startsWith('data:') ? src : fileUrl(src);
    img.draggable = false;
    box.appendChild(img);
  } else {
    box.appendChild(emojiNode(item.emoji || '📦'));
  }
  wrap.appendChild(box);

  wrap.addEventListener('click', () => {
    if (!editMode) window.customizer.openTarget(item.target, item.targetType);
  });

  wrap.addEventListener('mouseenter', () => {
    if (editMode) return;
    const r = box.getBoundingClientRect();
    dockTip.textContent = item.name;
    dockTip.style.left = r.left + r.width / 2 + 'px';
    dockTip.style.top = r.top - 30 + 'px';
    dockTip.classList.remove('hidden');
  });

  wrap.addEventListener('mouseleave', hideDockTip);

  // 편집 모드: 위로 드래그 → 바탕화면으로 꺼내기
  wrap.addEventListener('pointerdown', (e) => {
    if (!editMode || e.button !== 0) return;
    e.preventDefault();
    hideDockTip();
    wrap.setPointerCapture(e.pointerId);

    const onUp = (ev) => {
      wrap.removeEventListener('pointerup', onUp);
      if (ev.clientY < window.innerHeight - 120) {
        config.dock.items = config.dock.items.filter((i) => i.id !== item.id);
        item.x = Math.max(0, ev.clientX - 48);
        item.y = Math.max(0, ev.clientY - 48);
        config.icons.push(item);
        save();
        renderAll();
      }
    };
    wrap.addEventListener('pointerup', onUp);
  });

  return wrap;
}

function hideDockTip() {
  dockTip.classList.add('hidden');
}

// 마그니피케이션: 원본 macOS처럼 글래스 바는 고정, 아이콘이 위로 뚫고 나옴.
// - 아이콘 확대: scale (GPU 컴포지트, 레이아웃/blur 재계산 없음 → 떨림 없음)
// - 옆으로 밀어내기: 누적 translateX (확대분의 절반 보정으로 커서 중심 대칭)
let dockRaf = null;
let lastDockMouseX = 0;

function applyDockMagnification(mouseX) {
  const items = [...dockEl.querySelectorAll('.dock-item')];
  if (items.length === 0) return;

  const sigma = DOCK_ICON_SIZE * 1.2;
  // 1) 현재 위치로 스케일 계산 (레이아웃이 변하지 않아 위치는 항상 안정)
  const scales = items.map((el) => {
    const r = el.getBoundingClientRect();
    const d = Math.abs(mouseX - (r.left + r.width / 2));
    return 1 + 0.5 * Math.exp(-(d * d) / (sigma * sigma));
  });

  // 2) 적용
  let cumLeft = 0;
  const totalExtra = scales.reduce((s, sc) => s + DOCK_ICON_SIZE * (sc - 1), 0);
  items.forEach((el, i) => {
    const extra = DOCK_ICON_SIZE * (scales[i] - 1);
    el.style.transform = `translateX(${(cumLeft + extra / 2 - totalExtra / 2).toFixed(1)}px)`;
    const box = el.querySelector('.dock-icon');
    box.style.transform = `scale(${scales[i].toFixed(3)})`;
    cumLeft += extra;
  });
}

function resetDockMagnification() {
  hideDockTip();
  if (dockRaf) {
    cancelAnimationFrame(dockRaf);
    dockRaf = null;
  }
  dockEl.querySelectorAll('.dock-item').forEach((el) => {
    el.style.transform = '';
    el.querySelector('.dock-icon').style.transform = '';
  });
}

dockEl.addEventListener('mousemove', (e) => {
  if (editMode) return;
  lastDockMouseX = e.clientX;
  if (!dockRaf) {
    dockRaf = requestAnimationFrame(() => {
      dockRaf = null;
      applyDockMagnification(lastDockMouseX);
    });
  }
});
dockEl.addEventListener('mouseleave', resetDockMagnification);

// ── 아이콘 이벤트 (선택/실행/드래그/리사이즈/우클릭) ─────

function attachIconEvents(el, icon, handle, rotateHandle) {
  el.addEventListener('click', (e) => {
    if (!editMode) {
      if (icon.type === 'group') toggleDrawer(icon, el);
      else window.customizer.openTarget(icon.target, icon.targetType);
    } else if (icon.type === 'group') {
      toggleDrawer(icon, el); // 편집 모드에서도 드로어 열람 (꺼내기용)
    }
  });

  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (editMode) {
      // 우클릭한 아이콘이 선택돼 있지 않으면 그것만 선택
      if (!selected.has(icon.id)) {
        clearSelection();
        selected.add(icon.id);
        el.classList.add('selected');
      }
      openModal(icon.id);
    } else showContextMenu(e.clientX, e.clientY);
  });

  // 편집 모드: 클릭으로 선택 (Ctrl+클릭: 다중 선택)
  el.addEventListener('pointerdown', (e) => {
    if (!editMode || e.button !== 0) return;
    if (e.target === handle) return; // 핸들은 자체 핸들러에서

    if (e.ctrlKey || e.metaKey) {
      if (selected.has(icon.id)) {
        selected.delete(icon.id);
        el.classList.remove('selected');
      } else {
        selected.add(icon.id);
        el.classList.add('selected');
      }
      return;
    }
    if (!selected.has(icon.id)) {
      clearSelection();
      selected.add(icon.id);
      el.classList.add('selected');
    }
  });

  // 편집 모드에서 드래그 배치 (선택된 아이콘들은 함께 이동)
  el.addEventListener('pointerdown', (e) => {
    if (!editMode || e.button !== 0 || e.target === handle) return;
    if (e.ctrlKey || e.metaKey) return; // 선택 토글은 이동 아님
    e.preventDefault();

    const dragIds = [...selected]; // 선택 전체를 이동
    const origins = new Map(dragIds.map((id) => {
      const ic = findIcon(id);
      return [id, { x: ic.x, y: ic.y }];
    }));

    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;

    el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      // macOS 테마: Dock 영역 침입 방지용 하단 한계
      const maxY =
        window.innerHeight - (config.theme === 'macos' ? 110 : 0);
      dragIds.forEach((id) => {
        const ic = findIcon(id);
        const o = origins.get(id);
        ic.x = Math.max(0, o.x + dx);
        ic.y = Math.min(Math.max(0, o.y + dy), maxY - ic.size * themeIconFactor());
        const target = layer.querySelector(`[data-id="${id}"]`);
        if (target) {
          target.style.left = ic.x + 'px';
          target.style.top = ic.y + 'px';
        }
      });
    };

    const onUp = (ev) => {
      el.classList.remove('dragging');
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      if (!moved) return;

      // 단일 아이콘을 하단 Dock 영역에 드롭 → 도킹 (macOS 테마)
      if (
        config.theme === 'macos' &&
        dragIds.length === 1 &&
        icon.type !== 'group' &&
        ev.clientY > window.innerHeight - 100
      ) {
        config.icons = config.icons.filter((i) => i.id !== icon.id);
        config.dock.items.push(icon);
        selected.delete(icon.id);
        save();
        renderAll();
        return;
      }

      // 단일 아이콘을 그룹 위에 드롭 → 그룹에 수거
      if (dragIds.length === 1 && icon.type !== 'group') {
        el.style.pointerEvents = 'none';
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        el.style.pointerEvents = '';
        const groupEl = under?.closest('.icon.group');
        const group = groupEl && findIcon(groupEl.dataset.id);
        if (group && group.id !== icon.id) {
          config.icons = config.icons.filter((i) => i.id !== icon.id);
          group.items.push(icon);
          selected.delete(icon.id);
          save();
          renderAll();
          return;
        }
      }

      save();
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  });

  // 크기 조절 핸들
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editMode || e.button !== 0) return;

    const origSize = icon.size;
    const startX = e.clientX;
    const startY = e.clientY;

    handle.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      const d = ((ev.clientX - startX) + (ev.clientY - startY)) / 2;
      icon.size = Math.min(300, Math.max(32, origSize + d));
      const displaySize = icon.size * themeIconFactor();
      const imgBox = el.querySelector('.icon-image');
      imgBox.style.width = displaySize + 'px';
      imgBox.style.height = displaySize + 'px';
      imgBox.style.fontSize = Math.round(displaySize * 0.66) + 'px';
    };

    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      save();
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  });

  // 회전 핸들: 증분 방식 (±180° 경계를 넘어도 꼬이지 않음, 15° 단위 스냅)
  rotateHandle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editMode || e.button !== 0) return;

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const angleAt = (ev) => (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI;

    let lastAngle = angleAt(e);
    const inner = el.querySelector('.icon-inner');

    const wrapDeg = (r) => ((r + 180) % 360 + 360) % 360 - 180; // [-180, 180) 정규화

    rotateHandle.setPointerCapture(e.pointerId);
    rotateHandle.style.cursor = rotationCursor(icon.rotation ?? 0);

    const onMove = (ev) => {
      const a = angleAt(ev);
      let delta = a - lastAngle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      lastAngle = a;

      let r = (icon.rotation ?? 0) + delta;
      const snapped = Math.round(r / 15) * 15; // 15° 단위 스냅
      if (Math.abs(r - snapped) < 4) r = snapped;
      icon.rotation = Math.round(wrapDeg(r));
      inner.style.transform = `rotate(${icon.rotation}deg)`;
      rotateHandle.style.cursor = rotationCursor(icon.rotation);
    };

    const onUp = () => {
      rotateHandle.style.cursor = 'grab';
      rotateHandle.removeEventListener('pointermove', onMove);
      rotateHandle.removeEventListener('pointerup', onUp);
      save();
    };

    rotateHandle.addEventListener('pointermove', onMove);
    rotateHandle.addEventListener('pointerup', onUp);
  });
}

// 회전각을 따라가는 커서 (SVG 화살표를 각도만큼 회전)
function rotationCursor(deg) {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'>` +
    `<g transform='rotate(${deg} 14 14)'>` +
    `<path d='M14 3 L23 21 L14 16 L5 21 Z' fill='white' stroke='black' stroke-width='1.5'/>` +
    `</g></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 14 14, grab`;
}

// ── 폴더 그룹 드로어 ────────────────────────────────────

function toggleDrawer(group, anchorEl) {
  if (openGroupId === group.id) {
    hideDrawer();
    return;
  }
  openGroupId = group.id;
  renderDrawer(group, anchorEl);
}

function renderDrawer(group, anchorEl) {
  drawerEl.innerHTML = '';

  const title = document.createElement('div');
  title.className = 'drawer-title';
  title.textContent = `${group.emoji || '📁'} ${group.name}`;
  drawerEl.appendChild(title);

  if (group.items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'drawer-empty';
    empty.textContent = '비어 있어요 — 편집 모드에서 아이콘을 드래그해서 넣어보세요';
    drawerEl.appendChild(empty);
  } else {
    const grid = document.createElement('div');
    grid.className = 'drawer-grid';

    group.items.forEach((item) => {
      const cell = document.createElement('div');
      cell.className = 'drawer-item interactive';

      const imgBox = document.createElement('div');
      imgBox.className = 'di-image';
      const src = item.image || item.iconData;
      if (src) {
        const img = document.createElement('img');
        img.src = src.startsWith('data:') ? src : fileUrl(src);
        imgBox.appendChild(img);
      } else {
        imgBox.appendChild(emojiNode(item.emoji || '📦'));
      }

      const name = document.createElement('div');
      name.className = 'di-name';
      name.textContent = item.name;
      name.title = item.name;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'di-remove';
      removeBtn.textContent = '↩';
      removeBtn.title = '바탕화면으로 꺼내기';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeItemFromGroup(group, item);
      });

      cell.appendChild(imgBox);
      cell.appendChild(name);
      cell.appendChild(removeBtn);

      cell.addEventListener('click', () => {
        if (!editMode) {
          window.customizer.openTarget(item.target, item.targetType);
        }
      });

      grid.appendChild(cell);
    });

    drawerEl.appendChild(grid);
  }

  drawerEl.classList.remove('hidden');

  // 그룹 아이콘 바로 아래에 위치
  const rect = anchorEl.getBoundingClientRect();
  const dw = drawerEl.offsetWidth;
  const dh = drawerEl.offsetHeight;
  drawerEl.style.left = Math.min(rect.left, window.innerWidth - dw - 8) + 'px';
  drawerEl.style.top =
    (rect.bottom + 8 + dh > window.innerHeight
      ? Math.max(8, rect.top - dh - 8)
      : rect.bottom + 8) + 'px';
}

function hideDrawer() {
  openGroupId = null;
  drawerEl.classList.add('hidden');
}

function removeItemFromGroup(group, item) {
  group.items = group.items.filter((i) => i.id !== item.id);
  item.x = Math.min(Math.max(0, group.x + group.size + 20), window.innerWidth - 150);
  item.y = Math.min(Math.max(0, group.y + 100), window.innerHeight - 150);
  config.icons.push(item);
  save();
  renderAll();
}

// ── 삭제 (선택 삭제 / 전체 삭제 공용) ───────────────────

function deleteIcons(ids) {
  ids.forEach((id) => {
    const icon = findIcon(id);
    if (!icon) return;
    if (icon.type === 'group' && icon.items.length > 0) {
      // 그룹 삭제 시 안의 아이콘은 바탕화면으로 복원
      const positions = placeGrid(icon.items.length);
      icon.items.forEach((item, i) => {
        item.x = positions[i].x;
        item.y = positions[i].y;
        config.icons.push(item);
      });
    }
  });
  const idSet = new Set(ids);
  config.icons = config.icons.filter((i) => !idSet.has(i.id));
  clearSelection();
  save();
  renderAll();
}

// ── 편집 모달 ───────────────────────────────────────────

const backdrop = document.getElementById('modal-backdrop');
const f = {
  name: document.getElementById('f-name'),
  target: document.getElementById('f-target'),
  targetType: document.getElementById('f-target-type'),
  size: document.getElementById('f-size'),
  rotation: document.getElementById('f-rotation'),
  preview: document.getElementById('f-image-preview'),
};
const targetFields = document.getElementById('f-target-fields');

function openModal(iconId) {
  const icon = findIcon(iconId);
  if (!icon) return;
  editingIconId = iconId;

  const isGroup = icon.type === 'group';
  targetFields.style.display = isGroup ? 'none' : '';

  f.name.value = icon.name;
  f.target.value = icon.target ?? '';
  f.targetType.value = icon.targetType ?? 'exe';
  f.size.value = icon.size;
  f.rotation.value = icon.rotation ?? 0;
  updatePreview(icon);

  backdrop.classList.remove('hidden');
}

function updatePreview(icon) {
  f.preview.innerHTML = '';
  const src = icon.image || icon.iconData;
  if (src) {
    const img = document.createElement('img');
    img.src = src.startsWith('data:') ? src : fileUrl(src);
    f.preview.appendChild(img);
  } else {
    f.preview.appendChild(emojiNode(icon.emoji || '📦'));
  }
}

function closeModal() {
  editingIconId = null;
  backdrop.classList.add('hidden');
}

document.getElementById('btn-cancel').addEventListener('click', closeModal);

backdrop.addEventListener('click', (e) => {
  if (e.target === backdrop) closeModal();
});

document.getElementById('btn-save').addEventListener('click', () => {
  const icon = findIcon(editingIconId);
  if (!icon) return closeModal();

  icon.name = f.name.value.trim() || icon.name;
  if (icon.type !== 'group') {
    icon.target = f.target.value.trim();
    icon.targetType = f.targetType.value;
  }
  icon.size = Math.min(300, Math.max(32, Number(f.size.value) || icon.size));
  icon.rotation = Math.min(180, Math.max(-180, Number(f.rotation.value) || 0));

  save();
  renderAll();
  closeModal();
});

document.getElementById('btn-delete').addEventListener('click', () => {
  const id = editingIconId;
  closeModal();
  deleteIcons([id]);
});

document.getElementById('f-image-pick').addEventListener('click', async () => {
  const picked = await window.customizer.pickImage();
  const icon = findIcon(editingIconId);
  if (!picked || !icon) return;
  icon.image = picked;
  icon.iconData = null; // 이미지 파일이 우선
  updatePreview(icon);
});

// ── 우클릭 컨텍스트 메뉴 ────────────────────────────────

function showContextMenu(x, y) {
  contextMenu.classList.remove('hidden');
  const rect = contextMenu.getBoundingClientRect();
  contextMenu.style.left = Math.min(x, window.innerWidth - rect.width - 8) + 'px';
  contextMenu.style.top = Math.min(y, window.innerHeight - rect.height - 8) + 'px';
}

function hideContextMenu() {
  contextMenu.classList.add('hidden');
}

document.addEventListener('contextmenu', (e) => {
  if (e.target.closest('.icon')) return;
  e.preventDefault();
  showContextMenu(e.clientX, e.clientY);
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#context-menu')) hideContextMenu();
  if (!e.target.closest('#drawer') && !e.target.closest('.icon.group')) hideDrawer();
});

document.getElementById('menu-edit-mode').addEventListener('click', () => {
  window.customizer.requestEditMode(!editMode);
  hideContextMenu();
});

document.getElementById('menu-add-icon').addEventListener('click', () => {
  window.customizer.requestAddIcon();
  hideContextMenu();
});

document.getElementById('menu-import').addEventListener('click', () => {
  hideContextMenu();
  showOnboarding();
});

// 그리드 정렬: 최상위 아이콘을 현재 순서대로 자동 배치
document.getElementById('menu-align-grid').addEventListener('click', () => {
  hideContextMenu();
  const positions = placeGrid(config.icons.length);
  config.icons.forEach((icon, i) => {
    icon.x = positions[i].x;
    icon.y = positions[i].y;
  });
  save();
  renderAll();
});

document.getElementById('menu-delete-selected').addEventListener('click', () => {
  hideContextMenu();
  if (selected.size === 0) return;
  deleteIcons([...selected]);
});

document.getElementById('menu-set-background').addEventListener('click', async () => {
  hideContextMenu();
  const picked = await window.customizer.pickBackground();
  if (!picked) return;
  config.background = { type: 'image', path: picked };
  save();
  renderBackground();
});

document.getElementById('menu-clear-background').addEventListener('click', () => {
  config.background = { type: 'none', path: null };
  save();
  renderBackground();
  hideContextMenu();
});

document.getElementById('menu-clear-icons').addEventListener('click', async () => {
  hideContextMenu();
  if (config.icons.length === 0) return;
  const confirmed = await window.customizer.confirmDialog(
    '정말 모든 아이콘을 삭제할까요?',
    `아이콘 ${config.icons.length}개와 폴더 그룹 안의 아이콘까지 모두 삭제됩니다.\n이 작업은 되돌릴 수 없어요.`
  );
  if (!confirmed) return;
  config.icons = [];
  clearSelection();
  save();
  renderAll();
});

// 배경 프리셋 (macOS 시리즈)
Object.entries(BG_PRESETS).forEach(([key, preset]) => {
  document.getElementById(`menu-bg-${key}`).addEventListener('click', () => {
    hideContextMenu();
    config.background = { type: 'gradient', value: preset.value, flow: preset.flow };
    save();
    renderBackground();
  });
});

// 테마 전환
document.getElementById('menu-theme-default').addEventListener('click', () => {
  hideContextMenu();
  config.theme = 'default';
  save();
  applyTheme();
});

document.getElementById('menu-theme-macos').addEventListener('click', () => {
  hideContextMenu();
  config.theme = 'macos';
  save();
  applyTheme();
});

document.getElementById('menu-quit').addEventListener('click', () => {
  window.customizer.quitApp();
});

// ── 설정 모달 (단축키 변경) ─────────────────────────────

const settingsBackdrop = document.getElementById('settings-backdrop');
const sHotkey = document.getElementById('s-hotkey');
let pendingHotkey = null;

document.getElementById('menu-settings').addEventListener('click', () => {
  hideContextMenu();
  pendingHotkey = null;
  sHotkey.value = config.hotkey || 'F2';
  settingsBackdrop.classList.remove('hidden');
});

sHotkey.addEventListener('keydown', (e) => {
  e.preventDefault();
  if (/^F([1-9]|1[0-2])$/.test(e.key)) {
    pendingHotkey = e.key;
    sHotkey.value = e.key;
  }
});

document.getElementById('settings-cancel').addEventListener('click', () => {
  settingsBackdrop.classList.add('hidden');
});

settingsBackdrop.addEventListener('click', (e) => {
  if (e.target === settingsBackdrop) settingsBackdrop.classList.add('hidden');
});

document.getElementById('settings-save').addEventListener('click', async () => {
  if (pendingHotkey) {
    const res = await window.customizer.setHotkey(pendingHotkey);
    if (res.ok) config.hotkey = pendingHotkey;
  }
  settingsBackdrop.classList.add('hidden');
});

// ── 드래그앤드롭으로 아이콘 추가 ─────────────────────────

document.addEventListener('dragover', (e) => e.preventDefault());

document.addEventListener('drop', async (e) => {
  e.preventDefault();
  if (!editMode) return; // 편집 모드에서만 허용
  const files = [...e.dataTransfer.files];
  for (const file of files) {
    const p = window.customizer.pathForFile(file);
    if (!p) continue;
    await addIconFromPath(p, e.clientX, e.clientY);
  }
});

async function addIconFromPath(p, dropX, dropY) {
  const info = await window.customizer.importPath(p);
  if (!info || info.kind === 'error') return;

  const ext = p.split('.').pop().toLowerCase();

  if (info.kind === 'image') {
    // 이미지 파일 → 이미지 아이콘 (실행 대상은 모달에서 설정)
    const icon = {
      id: uid(),
      type: 'icon',
      name: info.name,
      image: info.image,
      emoji: null,
      target: '',
      targetType: 'exe',
      x: Math.max(0, dropX - 48),
      y: Math.max(0, dropY - 48),
      size: 96,
    };
    config.icons.push(icon);
    renderIcon(icon);
    save();
    openModal(icon.id); // 대상 설정 안내
    return;
  }

  // .lnk / .exe / 폴더 → 시스템 아이콘 추출해서 즉시 생성
  const icon = {
    id: uid(),
    type: 'icon',
    name: info.name,
    image: null,
    iconData: info.iconData,
    emoji: null,
    target: info.target,
    targetType: info.targetType,
    x: Math.max(0, dropX - 48),
    y: Math.max(0, dropY - 48),
    size: 96,
  };
  config.icons.push(icon);
  renderIcon(icon);
  save();
}

// ── 키보드 (Delete: 선택 삭제 / Esc: 해제) ───────────────

document.addEventListener('keydown', (e) => {
  if (!editMode) return;
  if (e.key === 'Delete' && selected.size > 0) {
    deleteIcons([...selected]);
  } else if (e.key === 'Escape') {
    clearSelection();
    closeModal();
    settingsBackdrop.classList.add('hidden');
    hideDrawer();
    hideContextMenu();
  }
});

// ── 온보딩: 바탕화면 아이콘 가져오기 ────────────────────

const obList = document.getElementById('ob-list');
const obCount = document.getElementById('ob-count');
let scannedItems = [];

function updateObCount() {
  const n = scannedItems.filter((s) => s.checked).length;
  obCount.textContent = `${n}개 선택됨`;
}

function renderObList() {
  obList.innerHTML = '';
  if (scannedItems.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'ob-empty';
    empty.textContent = '가져올 아이콘이 없어요. 바탕화면이 비어 있나 보네요!';
    obList.appendChild(empty);
    return;
  }

  scannedItems.forEach((item, idx) => {
    const row = document.createElement('label');
    row.className = 'ob-item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = item.checked;
    cb.addEventListener('change', () => {
      item.checked = cb.checked;
      updateObCount();
    });

    const emoji = document.createElement('span');
    emoji.className = 'ob-emoji';
    emoji.appendChild(emojiNode(THEME_EMOJIS[idx % THEME_EMOJIS.length]));

    const name = document.createElement('span');
    name.className = 'ob-name';
    name.textContent = item.name;
    name.title = item.target;

    const type = document.createElement('span');
    type.className = 'ob-type';
    type.textContent = TYPE_LABELS[item.targetType] || item.targetType;

    row.appendChild(cb);
    row.appendChild(emoji);
    row.appendChild(name);
    row.appendChild(type);
    obList.appendChild(row);
  });
}

async function showOnboarding() {
  scannedItems = (await window.customizer.scanDesktop()).map((s) => ({ ...s, checked: true }));
  renderObList();
  updateObCount();
  hideDrawer();
  onboardingEl.classList.remove('hidden');
}

document.getElementById('ob-select-all').addEventListener('click', () => {
  scannedItems.forEach((s) => (s.checked = true));
  renderObList();
  updateObCount();
});

document.getElementById('ob-select-none').addEventListener('click', () => {
  scannedItems.forEach((s) => (s.checked = false));
  renderObList();
  updateObCount();
});

document.getElementById('ob-skip').addEventListener('click', () => {
  if (!config.background || config.background.type === 'none') {
    config.background = { type: 'gradient', value: DEFAULT_GRADIENT };
    save();
    renderBackground();
  }
  onboardingEl.classList.add('hidden');
});

document.getElementById('ob-apply').addEventListener('click', () => {
  const selectedItems = scannedItems.filter((s) => s.checked);
  const rest = scannedItems.filter((s) => !s.checked);

  // 1. 선택한 아이콘: 기본 테마(이모지) + 자동 그리드 배치
  const positions = placeGrid(selectedItems.length);
  selectedItems.forEach((s, i) => {
    config.icons.push({
      id: uid(),
      type: 'icon',
      name: s.name,
      image: null,
      emoji: THEME_EMOJIS[i % THEME_EMOJIS.length],
      target: s.target,
      targetType: s.targetType,
      x: positions[i].x,
      y: positions[i].y,
      size: 96,
    });
  });

  // 2. 선택 안 한 아이콘: 폴더 그룹 하나에 수거
  if (rest.length > 0) {
    const gpos = placeGrid(selectedItems.length + 1)[selectedItems.length];
    config.icons.push({
      id: uid(),
      type: 'group',
      name: '나머지 아이콘',
      image: null,
      emoji: '📁',
      x: gpos.x,
      y: gpos.y,
      size: 96,
      items: rest.map((s) => ({
        id: uid(),
        name: s.name,
        image: null,
        emoji: null,
        target: s.target,
        targetType: s.targetType,
      })),
    });
  }

  // 3. 배경이 비어 있으면 기본 그라데이션
  if (!config.background || config.background.type === 'none') {
    config.background = { type: 'gradient', value: DEFAULT_GRADIENT };
  }

  save();
  renderAll();
  onboardingEl.classList.add('hidden');
});

// ── 클릭 통과 (빈 영역은 바탕화면으로 이벤트 전달) ────────

document.addEventListener('mousemove', (e) => {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const overInteractive = !!el?.closest(
    '.interactive, #modal-backdrop, #settings-backdrop, #context-menu, #drawer, #onboarding, #dock'
  );
  window.customizer.setIgnoreMouse(!overInteractive);
});

// ── 트레이 → 렌더러 이벤트 ───────────────────────────────

window.customizer.onSetEditMode((on) => {
  editMode = on;
  document.body.classList.toggle('edit-mode', on);
  hideDrawer();
  if (!on) clearSelection();
});

window.customizer.onIconAdded((data) => {
  const icon = {
    id: uid(),
    type: 'icon',
    name: data.name,
    image: data.image,
    emoji: null,
    target: data.target,
    targetType: data.targetType,
    x: 120 + config.icons.length * 150,
    y: 120,
    size: 96,
  };
  config.icons.push(icon);
  renderIcon(icon);
  save();
});

// ── 초기화 ──────────────────────────────────────────────

(async () => {
  const { config: cfg, firstRun } = await window.customizer.loadConfig();
  config = cfg;
  config.icons ??= [];
  config.theme ??= 'default';
  config.dock ??= { items: [] };

  injectSquircleMask();

  editMode = config.editMode ?? false;
  document.body.classList.toggle('edit-mode', editMode);
  applyTheme();
  renderAll();

  if (firstRun) showOnboarding();
})();
