import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('isElectronApp', true)
