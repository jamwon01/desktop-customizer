const { app, BrowserWindow, screen, ipcMain, shell } = require('electron');
const path = require('path');

let layerWindow = null;

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

// IPC: 빈 영역은 클릭이 바탕화면으로 통과하도록 설정
ipcMain.on('set-ignore-mouse', (_event, ignore) => {
  if (!layerWindow) return;
  if (ignore) {
    layerWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    layerWindow.setIgnoreMouseEvents(false);
  }
});

// IPC: 타겟 실행 (exe / 폴더 / URL)
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

app.whenReady().then(createLayerWindow);

app.on('window-all-closed', () => {
  app.quit();
});
