const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('customizer', {
  // 빈 영역 클릭 통과 on/off
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  // 아이콘 타겟 실행
  openTarget: (target, targetType) => ipcRenderer.invoke('open-target', target, targetType),
});
