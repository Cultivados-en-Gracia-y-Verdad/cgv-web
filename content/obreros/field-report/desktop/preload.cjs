const {contextBridge,ipcRenderer}=require('electron');

contextBridge.exposeInMainWorld('cgvDesktop',{
  syncPull:()=>ipcRenderer.invoke('cgv:sync-pull'),
  syncPush:()=>ipcRenderer.invoke('cgv:sync-push'),
  prepareSite:()=>ipcRenderer.invoke('cgv:prepare-site'),
  platform:process.platform,
});
