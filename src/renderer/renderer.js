const layer = document.getElementById('icon-layer');
const banner = document.createElement('div');
banner.id = 'edit-banner';
banner.textContent = '편집 모드 — 아이콘을 드래그해 배치 · 우클릭으로 편집';
document.body.appendChild(banner);

let config = null;
let editMode = false;
let editingIconId = null; // 모달에서 편집 중인 아이콘

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

// ── 렌더링 ──────────────────────────────────────────────

function renderIcon(icon) {
  const el = document.createElement('div');
  el.className = 'icon interactive';
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
    imgBox.textContent = icon.emoji || '📦';
  }

  const name = document.createElement('div');
  name.className = 'icon-name';
  name.textContent = icon.name;

  el.appendChild(imgBox);
  el.appendChild(name);
  layer.appendChild(el);

  attachIconEvents(el, icon);
}

function renderAll() {
  layer.innerHTML = '';
  config.icons.forEach(renderIcon);
}

// ── 아이콘 이벤트 (클릭 실행 / 드래그 / 우클릭 편집) ─────

function attachIconEvents(el, icon) {
  el.addEventListener('click', () => {
    if (!editMode) {
      window.customizer.openTarget(icon.target, icon.targetType);
    }
  });

  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (editMode) openModal(icon.id);
  });

  // 편집 모드에서 드래그 배치
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

    const onUp = () => {
      el.classList.remove('dragging');
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      if (moved) save();
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  });
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

function openModal(iconId) {
  const icon = findIcon(iconId);
  if (!icon) return;
  editingIconId = iconId;

  f.name.value = icon.name;
  f.target.value = icon.target;
  f.targetType.value = icon.targetType;
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
  icon.target = f.target.value.trim();
  icon.targetType = f.targetType.value;
  icon.size = Math.min(256, Math.max(32, Number(f.size.value) || icon.size));

  save();
  renderAll();
  closeModal();
});

document.getElementById('btn-delete').addEventListener('click', () => {
  config.icons = config.icons.filter((i) => i.id !== editingIconId);
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

// ── 클릭 통과 (빈 영역은 바탕화면으로 이벤트 전달) ────────

document.addEventListener('mousemove', (e) => {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const overInteractive = !!el?.closest('.interactive, #modal-backdrop');
  window.customizer.setIgnoreMouse(!overInteractive);
});

// ── 트레이 → 렌더러 이벤트 ───────────────────────────────

window.customizer.onSetEditMode((on) => {
  editMode = on;
  document.body.classList.toggle('edit-mode', on);
});

window.customizer.onIconAdded((data) => {
  // 겹치지 않는 위치에 배치 (화면 좌측에서 오른쪽으로)
  const count = config.icons.length;
  const icon = {
    id: uid(),
    name: data.name,
    image: data.image,
    emoji: null,
    target: data.target,
    targetType: data.targetType,
    x: 120 + count * 150,
    y: 120,
    size: 96,
  };
  config.icons.push(icon);
  renderIcon(icon);
  save();
});

// ── 초기화 ──────────────────────────────────────────────

(async () => {
  config = await window.customizer.loadConfig();
  editMode = config.editMode ?? false;
  document.body.classList.toggle('edit-mode', editMode);
  renderAll();
})();
