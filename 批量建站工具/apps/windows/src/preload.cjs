/* This file runs in an isolated sandbox. Keep the bridge method list explicit:
 * no ipcRenderer, process, filesystem or arbitrary channel reaches web content. */
const { contextBridge, ipcRenderer } = require('electron');

if (process.isMainFrame) {
  const invoke = (operation, payload) => ipcRenderer.invoke('sitefoundry:native', operation, payload);
  contextBridge.exposeInMainWorld('SiteFoundryNative', Object.freeze({
    platform: 'windows',
    capabilities: () => invoke('capabilities'),
    getPlatformInfo: () => invoke('getPlatformInfo'),
    saveFile: payload => invoke('saveFile', payload),
    saveBlob: payload => invoke('saveFile', payload),
    importFiles: options => invoke('importFiles', options),
    selectDirectory: () => invoke('selectDirectory'),
    selectImportDirectory: () => invoke('selectImportDirectory'),
    readImportFile: payload => invoke('readImportFile', payload),
    startFile: payload => invoke('startFile', payload),
    appendFile: payload => invoke('appendFile', payload),
    finishFile: payload => invoke('finishFile', payload),
    cancelFile: payload => invoke('cancelFile', payload),
    templates: Object.freeze({
      list: () => invoke('templates.list'),
      read: version => invoke('templates.read', { version }),
      analyze: payload => invoke('templates.analyze', payload),
      write: payload => invoke('templates.write', payload),
      setDefault: version => invoke('templates.default', { version }),
      delete: version => invoke('templates.delete', { version })
    }),
    buildProject: payload => invoke('buildProject', payload),
    prepareProject: payload => invoke('prepareProject', payload),
    buildStatus: payload => invoke('buildStatus', payload),
    cancelBuild: payload => invoke('cancelBuild', payload),
    openBuildPreview: payload => invoke('openBuildPreview', payload),
    importProject: payload => invoke('importProject', payload),
    listProjects: () => invoke('listProjects'),
    inspectProject: payload => invoke('inspectProject', payload),
    startBuild: payload => invoke('startBuild', payload),
    taskStatus: payload => invoke('taskStatus', payload),
    cancelTask: payload => invoke('cancelTask', payload),
    exportArtifact: payload => invoke('exportArtifact', payload),
    previewArtifact: payload => invoke('previewArtifact', payload)
  }));
}
