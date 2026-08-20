import { contextBridge, ipcRenderer } from 'electron'
import type { WindowApi, IpcMap } from '@shared/types'

function invoke<K extends keyof IpcMap>(
  channel: K,
  ...args: IpcMap[K]['args']
): Promise<IpcMap[K]['return']> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcMap[K]['return']>
}

const api: WindowApi = {
  'vault:isSetup': () => invoke('vault:isSetup'),
  'vault:setup': (password, mongoUri) => invoke('vault:setup', password, mongoUri),
  'vault:unlock': (password) => invoke('vault:unlock', password),
  'vault:lock': () => invoke('vault:lock'),
  'vault:isUnlocked': () => invoke('vault:isUnlocked'),
  'vault:testMongo': (uri) => invoke('vault:testMongo', uri),
  'vault:reset': () => invoke('vault:reset'),

  'apps:list': () => invoke('apps:list'),
  'apps:create': (name) => invoke('apps:create', name),
  'apps:rename': (id, name) => invoke('apps:rename', id, name),
  'apps:delete': (id) => invoke('apps:delete', id),

  'secrets:list': (appId) => invoke('secrets:list', appId),
  'secrets:reveal': (secretId) => invoke('secrets:reveal', secretId),
  'secrets:set': (appId, key, value, existingId) => invoke('secrets:set', appId, key, value, existingId),
  'secrets:delete': (secretId) => invoke('secrets:delete', secretId),
  'secrets:import': (appId, envText) => invoke('secrets:import', appId, envText),

  'links:add': (appId, folderPath, format) => invoke('links:add', appId, folderPath, format),
  'links:remove': (linkId) => invoke('links:remove', linkId),
  'links:sync': (linkId) => invoke('links:sync', linkId),
  'links:syncAll': (appId) => invoke('links:syncAll', appId),

  'settings:get': () => invoke('settings:get'),
  'settings:set': (patch) => invoke('settings:set', patch),
  'settings:migrateStorage': (targetMode, mongoUri) => invoke('settings:migrateStorage', targetMode, mongoUri),

  'app:getInfo': () => invoke('app:getInfo'),

  'window:setLayout': (layout) => invoke('window:setLayout', layout),

  'dialog:openFolder': () => invoke('dialog:openFolder')
}

contextBridge.exposeInMainWorld('api', api)

declare global {
  interface Window {
    api: WindowApi
  }
}
