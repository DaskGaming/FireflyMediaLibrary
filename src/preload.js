const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  scanMedia:        ()       => ipcRenderer.invoke('scan-media'),
  getConfig:        ()       => ipcRenderer.invoke('get-config'),
  getPlayback:      ()       => ipcRenderer.invoke('get-playback'),
  saveConfig:       (cfg)    => ipcRenderer.invoke('save-config', cfg),
  play:             (item)   => ipcRenderer.invoke('play', item),
  updateProgress:   (data)   => ipcRenderer.invoke('update-progress', data),
  browseFolder:     ()       => ipcRenderer.invoke('browse-folder'),
  quit:             ()       => ipcRenderer.invoke('quit'),
  toggleFullscreen: ()       => ipcRenderer.invoke('toggle-fullscreen'),
  stopPlayback:     ()       => ipcRenderer.invoke('stop-playback'),
  onVlcClosed:      (cb)     => ipcRenderer.on('vlc-closed', cb),
  onSuspend:        (cb)     => ipcRenderer.on('app-suspend', cb),
  onResume:         (cb)     => ipcRenderer.on('app-resume', cb),
  // Convert local file path to a safe URL for displaying images
  fileUrl: (filePath) => {
    if (!filePath) return null;
    return 'file://' + filePath.replace(/\\/g, '/');
  }
});
