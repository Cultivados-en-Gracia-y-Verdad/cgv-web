const {contextBridge,ipcRenderer}=require('electron');

contextBridge.exposeInMainWorld('cgvDesktop',{
  syncPull:()=>ipcRenderer.invoke('cgv:sync-pull'),
  platform:process.platform,
});
