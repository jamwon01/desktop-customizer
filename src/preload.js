const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('customizer', {
  // 빈 영역 클릭 통과 on/off
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  // 아이콘 타겟 실행
  openTarget: (target, targetType) => ipcRenderer.invoke('open-target', target, targetType),
  // 설정
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveConfig: (cfg) => ipcRenderer.invoke('save-config', cfg),
  pickImage: () => ipcRenderer.invoke('pick-image'),
  pickBackground: () => ipcRenderer.invoke('pick-background'),
  // 렌더러 → 메인 요청 (우클릭 메뉴용)
  requestEditMode: (on) => ipcRenderer.send('request-edit-mode', on),
  requestAddIcon: () => ipcRenderer.send('request-add-icon'),
  quitApp: () => ipcRenderer.send('quit-app'),
  // 트레이 → 렌더러 이벤트
  onSetEditMode: (cb) => ipcRenderer.on('set-edit-mode', (_e, on) => cb(on)),
  onIconAdded: (cb) => ipcRenderer.on('icon-added', (_e, data) => cb(data)),
});
