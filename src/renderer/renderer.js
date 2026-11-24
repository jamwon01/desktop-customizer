const layer = document.getElementById('icon-layer');
const bgEl = document.getElementById('background');
const contextMenu = document.getElementById('context-menu');
const drawerEl = document.getElementById('drawer');
const onboardingEl = document.getElementById('onboarding');

let config = null;
let editMode = false;
let editingIconId = null;
let openGroupId = null; // 현재 펼쳐진 그룹

// ── 기본 테마 ───────────────────────────────────────────

const THEME_EMOJIS = ['🐱', '🌟', '🎮', '🦊', '🎵', '💎', '🌸', '⭐', '🐶', '🚀', '🍀', '🎨', '🦄', '🌙', '🍓', '👾'];
const DEFAULT_GRADIENT = 'linear-gradient(160deg, #667eea 0%, #764ba2 100%)';
const TYPE_LABELS = { exe: '프로그램', folder: '폴더', url: 'URL' };

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

// ── 렌더링 ──────────────────────────────────────────────

function renderIcon(icon) {
  const isGroup = icon.type === 'group';
  const el = document.createElement('div');
  el.className = 'icon interactive' + (isGroup ? ' group' : '');
  el.dataset.id = icon.id;
  el.style.left = icon.x + 'px';
  el.style.top = icon.y + 'px';

  const imgBox = document.createElement('div');
  imgBox.className = 'icon-image';
  imgBox.style.width = icon.size + 'px';
  imgBox.style.height = icon.size + 'px';
  if (icon.image) {
    const img = document.createElement('img');
    img.src = fileUrl(icon.image);
    img.draggable = false;
    imgBox.appendChild(img);
  } else {
    imgBox.textContent = icon.emoji || (isGroup ? '📁' : '📦');
  }

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

  layer.appendChild(el);
  attachIconEvents(el, icon);
}

function renderAll() {
  renderBackground();
  hideDrawer();
  layer.innerHTML = '';
  config.icons.forEach(renderIcon);
}

// ── 배경 렌더링 ─────────────────────────────────────────

function renderBackground() {
  const bg = config.background;
  if (bg?.type === 'image' && bg.path) {
    bgEl.style.backgroundImage = `url("${fileUrl(bg.path)}")`;
  } else if (bg?.type === 'gradient' && bg.value) {
    bgEl.style.backgroundImage = bg.value;
  } else {
    bgEl.style.backgroundImage = 'none';
  }
}

// ── 아이콘 이벤트 (클릭 실행 / 드래그 / 우클릭 편집) ─────

function attachIconEvents(el, icon) {
  el.addEventListener('click', () => {
    if (icon.type === 'group') {
      toggleDrawer(icon, el);
    } else if (!editMode) {
      window.customizer.openTarget(icon.target, icon.targetType);
    }
  });

  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (editMode) openModal(icon.id);
    else showContextMenu(e.clientX, e.clientY);
  });

  // 편집 모드에서 드래그 배치 (+ 그룹에 드롭 가능)
  el.addEventListener('pointerdown', (e) => {
    if (!editMode || e.button !== 0) return;
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = icon.x;
    const origY = icon.y;
    let moved = false;

    el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      icon.x = Math.max(0, origX + dx);
      icon.y = Math.max(0, origY + dy);
      el.style.left = icon.x + 'px';
      el.style.top = icon.y + 'px';
    };

    const onUp = (ev) => {
      el.classList.remove('dragging');
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);

      if (!moved) return;

      // 일반 아이콘을 그룹 위에 드롭 → 그룹에 수거
      if (icon.type !== 'group') {
        el.style.pointerEvents = 'none'; // 자기 자신은 제외하고 판정
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        el.style.pointerEvents = '';
        const groupEl = under?.closest('.icon.group');
        const group = groupEl && findIcon(groupEl.dataset.id);
        if (group && group.id !== icon.id) {
          config.icons = config.icons.filter((i) => i.id !== icon.id);
          group.items.push(icon);
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
      if (item.image) {
        const img = document.createElement('img');
        img.src = fileUrl(item.image);
        imgBox.appendChild(img);
      } else {
        imgBox.textContent = item.emoji || '📦';
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

// ── 편집 모달 ───────────────────────────────────────────

const backdrop = document.getElementById('modal-backdrop');
const f = {
  name: document.getElementById('f-name'),
  target: document.getElementById('f-target'),
  targetType: document.getElementById('f-target-type'),
  size: document.getElementById('f-size'),
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
  updatePreview(icon);

  backdrop.classList.remove('hidden');
}

function updatePreview(icon) {
  f.preview.innerHTML = '';
  if (icon.image) {
    const img = document.createElement('img');
    img.src = fileUrl(icon.image);
    f.preview.appendChild(img);
  } else {
    f.preview.textContent = icon.emoji || '📦';
  }
}

function closeModal() {
  editingIconId = null;
  backdrop.classList.add('hidden');
}

document.getElementById('btn-cancel').addEventListener('click', closeModal);

// 모달 바깥(어두운 영역) 클릭 시 닫기
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
  icon.size = Math.min(256, Math.max(32, Number(f.size.value) || icon.size));

  save();
  renderAll();
  closeModal();
});

document.getElementById('btn-delete').addEventListener('click', () => {
  const icon = findIcon(editingIconId);
  if (!icon) return closeModal();

  if (icon.type === 'group' && icon.items.length > 0) {
    // 그룹 삭제 시 안의 아이콘은 바탕화면으로 복원
    const positions = placeGrid(icon.items.length);
    icon.items.forEach((item, i) => {
      item.x = positions[i].x;
      item.y = positions[i].y;
      config.icons.push(item);
    });
  }
  config.icons = config.icons.filter((i) => i.id !== icon.id);
  save();
  renderAll();
  closeModal();
});

document.getElementById('f-image-pick').addEventListener('click', async () => {
  const picked = await window.customizer.pickImage();
  const icon = findIcon(editingIconId);
  if (!picked || !icon) return;
  icon.image = picked;
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
  if (e.target.closest('.icon')) return; // 아이콘은 자체 핸들러에서 처리
  e.preventDefault();
  showContextMenu(e.clientX, e.clientY);
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#context-menu')) hideContextMenu();
  // 드로어 바깥 클릭 시 닫기 (그룹 아이콘 토글은 자체 핸들러가 처리)
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
  save();
  renderAll();
});

document.getElementById('menu-quit').addEventListener('click', () => {
  window.customizer.quitApp();
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
    emoji.textContent = THEME_EMOJIS[idx % THEME_EMOJIS.length];

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
  // 배경만 기본 테마로
  if (!config.background || config.background.type === 'none') {
    config.background = { type: 'gradient', value: DEFAULT_GRADIENT };
    save();
    renderBackground();
  }
  onboardingEl.classList.add('hidden');
});

document.getElementById('ob-apply').addEventListener('click', () => {
  const selected = scannedItems.filter((s) => s.checked);
  const rest = scannedItems.filter((s) => !s.checked);

  // 1. 선택한 아이콘: 기본 테마(이모지) + 자동 그리드 배치
  const positions = placeGrid(selected.length);
  selected.forEach((s, i) => {
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
    const gpos = placeGrid(selected.length + 1)[selected.length];
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
  const overInteractive = !!el?.closest('.interactive, #modal-backdrop, #context-menu, #drawer, #onboarding');
  window.customizer.setIgnoreMouse(!overInteractive);
});

// ── 트레이 → 렌더러 이벤트 ───────────────────────────────

window.customizer.onSetEditMode((on) => {
  editMode = on;
  document.body.classList.toggle('edit-mode', on);
  hideDrawer();
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

  editMode = config.editMode ?? false;
  document.body.classList.toggle('edit-mode', editMode);
  renderAll();

  if (firstRun) showOnboarding();
})();
