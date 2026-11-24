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
  // 트레이 → 렌더러 이벤트
  onSetEditMode: (cb) => ipcRenderer.on('set-edit-mode', (_e, on) => cb(on)),
  onIconAdded: (cb) => ipcRenderer.on('icon-added', (_e, data) => cb(data)),
});
