const { app, BrowserWindow, screen, ipcMain, shell, dialog, Menu, Tray, nativeImage, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

let layerWindow = null;
let tray = null;
let editMode = false;

// ── 설정 파일 (config.json) ──────────────────────────────

function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

const DEFAULT_CONFIG = {
  editMode: false,
  background: { type: 'none', path: null },
  icons: [
    {
      id: 'test-1',
      name: '테스트 캐릭터',
      image: null,
      emoji: '🐱',
      target: 'https://github.com/jamwon01',
      targetType: 'url',
      x: 120, y: 120, size: 96,
    },
    {
      id: 'test-2',
      name: '테스트 2',
      image: null,
      emoji: '🐶',
      target: 'https://www.google.com',
      targetType: 'url',
      x: 280, y: 120, size: 96,
    },
  ],
};

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(cfg) {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf8');
}

// ── 레이어 윈도우 ────────────────────────────────────────

function createLayerWindow() {
  const { width, height } = screen.getPrimaryDisplay().bounds;

  layerWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  layerWindow.setMenuBarVisibility(false);
  layerWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

// ── 트레이 ───────────────────────────────────────────────

// 1x1 파란 픽셀 (MVP 임시 트레이 아이콘)
const TRAY_ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function setEditMode(on) {
  editMode = on;
  const cfg = loadConfig();
  cfg.editMode = on;
  saveConfig(cfg);
  // 트레이 체크박스 상태 동기화
  if (trayMenu) trayMenu.getMenuItemById('edit-mode-item').checked = on;
  if (layerWindow) layerWindow.webContents.send('set-edit-mode', on);
}

let trayMenu = null;

function createTray() {
  tray = new Tray(nativeImage.createFromDataURL(TRAY_ICON));
  tray.setToolTip('Desktop Customizer');
  trayMenu = Menu.buildFromTemplate([
    {
      id: 'edit-mode-item',
      label: '편집 모드 (F2)',
      type: 'checkbox',
      checked: editMode,
      click: (item) => setEditMode(item.checked),
    },
    { type: 'separator' },
    { label: '아이콘 추가', click: () => addIconFlow() },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(trayMenu);
}

// ── 아이콘 추가 플로우: 이미지 선택 → 대상 선택 → 렌더러에 전달 ──

async function addIconFlow() {
  if (!layerWindow) return;

  const imgPick = await dialog.showOpenDialog(layerWindow, {
    title: '아이콘 이미지 선택',
    filters: [{ name: '이미지', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    properties: ['openFile'],
  });
  if (imgPick.canceled || imgPick.filePaths.length === 0) return;

  const targetPick = await dialog.showOpenDialog(layerWindow, {
    title: '실행할 대상 선택 (프로그램/폴더)',
    properties: ['openFile', 'openDirectory'],
  });
  if (targetPick.canceled || targetPick.filePaths.length === 0) return;

  const target = targetPick.filePaths[0];
  let isDir = false;
  try {
    isDir = fs.statSync(target).isDirectory();
  } catch {}

  layerWindow.webContents.send('icon-added', {
    image: imgPick.filePaths[0],
    target,
    targetType: isDir ? 'folder' : 'exe',
    name: path.basename(target, path.extname(target)),
  });
}

// ── IPC ─────────────────────────────────────────────────

ipcMain.on('set-ignore-mouse', (_event, ignore) => {
  if (!layerWindow) return;
  if (ignore && !editMode) {
    layerWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    layerWindow.setIgnoreMouseEvents(false);
  }
});

ipcMain.handle('load-config', () => loadConfig());

ipcMain.handle('save-config', (_event, cfg) => {
  saveConfig(cfg);
  return { ok: true };
});

ipcMain.handle('pick-image', async () => {
  const pick = await dialog.showOpenDialog(layerWindow, {
    title: '아이콘 이미지 선택',
    filters: [{ name: '이미지', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    properties: ['openFile'],
  });
  if (pick.canceled || pick.filePaths.length === 0) return null;
  return pick.filePaths[0];
});

ipcMain.handle('pick-background', async () => {
  const pick = await dialog.showOpenDialog(layerWindow, {
    title: '배경 이미지 선택',
    filters: [{ name: '이미지', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    properties: ['openFile'],
  });
  if (pick.canceled || pick.filePaths.length === 0) return null;
  return pick.filePaths[0];
});

// 렌더러 → 메인 요청
ipcMain.on('request-edit-mode', (_event, on) => setEditMode(on));
ipcMain.on('request-add-icon', () => addIconFlow());
ipcMain.on('quit-app', () => app.quit());

ipcMain.handle('open-target', async (_event, target, targetType) => {
  try {
    if (targetType === 'url') {
      await shell.openExternal(target);
    } else {
      await shell.openPath(target);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// ── 앱 생명주기 ──────────────────────────────────────────

app.whenReady().then(() => {
  editMode = loadConfig().editMode ?? false;
  createLayerWindow();
  createTray();
  // 전역 단축키: F2 = 편집 모드 토글 (레이어에 포커스가 없어도 동작)
  globalShortcut.register('F2', () => setEditMode(!editMode));
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  app.quit();
});
