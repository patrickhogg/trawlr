"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("spider", {
  // Crawl operations
  startCrawl: (settings) => electron.ipcRenderer.invoke("crawl:start", settings),
  cancelCrawl: () => electron.ipcRenderer.invoke("crawl:cancel"),
  getResults: () => electron.ipcRenderer.invoke("crawl:results"),
  getProgress: () => electron.ipcRenderer.invoke("crawl:progress:get"),
  exportCsv: (type) => electron.ipcRenderer.invoke("crawl:export-csv", type),
  getDefaultUserAgent: () => electron.ipcRenderer.invoke("crawl:default-ua"),
  // History / persistence
  saveCrawl: () => electron.ipcRenderer.invoke("history:save"),
  listCrawls: () => electron.ipcRenderer.invoke("history:list"),
  loadCrawl: (id) => electron.ipcRenderer.invoke("history:load", id),
  deleteCrawl: (id) => electron.ipcRenderer.invoke("history:delete", id),
  // Progress & page event listeners
  onProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    electron.ipcRenderer.on("crawl:progress", listener);
    return () => electron.ipcRenderer.removeListener("crawl:progress", listener);
  },
  onPage: (callback) => {
    const listener = (_event, page) => callback(page);
    electron.ipcRenderer.on("crawl:page", listener);
    return () => electron.ipcRenderer.removeListener("crawl:page", listener);
  }
});
