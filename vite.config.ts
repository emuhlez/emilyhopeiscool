import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const isElectron = !!process.env.ELECTRON

// https://vite.dev/config/
export default defineConfig(async () => {
  const plugins: PluginOption[] = [tailwindcss(), react()]

  if (isElectron) {
    const electron = (await import('vite-plugin-electron/simple')).default
    plugins.push(
      electron({
        // Root package.json has "type": "module", which would emit ESM for the main
        // process. ESM `import 'electron'` resolves to the npm path stub; CommonJS
        // `require('electron')` uses Electron's real API. Build main as .cjs.
        // Vite mergeConfig *concatenates* lib.formats arrays, so we must fix after merge.
        main: {
          entry: 'electron/main.ts',
          vite: {
            plugins: [
              {
                name: 'electron-main-cjs-only',
                configResolved(config) {
                  const lib = config.build.lib
                  if (lib && typeof lib === 'object' && Array.isArray(lib.formats)) {
                    lib.formats = ['cjs']
                  }
                },
              },
            ],
            build: {
              lib: {
                entry: 'electron/main.ts',
                formats: ['cjs'],
                fileName: () => 'main.cjs',
              },
            },
          },
        },
        preload: { input: 'electron/preload.ts' },
      }) as PluginOption,
    )
  }

  return {
    base: '/',
    plugins,
  }
})
