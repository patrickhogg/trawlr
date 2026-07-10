import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose Trawlr API to the Renderer process ---------
contextBridge.exposeInMainWorld('spider', {
  // Crawl operations
  startCrawl: (settings: any) => ipcRenderer.invoke('crawl:start', settings),
  cancelCrawl: () => ipcRenderer.invoke('crawl:cancel'),
  getResults: () => ipcRenderer.invoke('crawl:results'),
  getProgress: () => ipcRenderer.invoke('crawl:progress:get'),
  exportCsv: (type: string) => ipcRenderer.invoke('crawl:export-csv', type),
  getDefaultUserAgent: () => ipcRenderer.invoke('crawl:default-ua'),

  // History / persistence
  saveCrawl: () => ipcRenderer.invoke('history:save'),
  listCrawls: () => ipcRenderer.invoke('history:list'),
  loadCrawl: (id: string) => ipcRenderer.invoke('history:load', id),
  deleteCrawl: (id: string) => ipcRenderer.invoke('history:delete', id),

  // Progress & page event listeners
  onProgress: (callback: (progress: any) => void) => {
    const listener = (_event: any, progress: any) => callback(progress)
    ipcRenderer.on('crawl:progress', listener)
    return () => ipcRenderer.removeListener('crawl:progress', listener)
  },
  onPage: (callback: (page: any) => void) => {
    const listener = (_event: any, page: any) => callback(page)
    ipcRenderer.on('crawl:page', listener)
    return () => ipcRenderer.removeListener('crawl:page', listener)
  },
})
