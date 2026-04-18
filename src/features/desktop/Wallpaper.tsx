import { motion, useReducedMotion } from 'framer-motion'

import wallpaperUrl from '../../../desktop/macintosh-desktop.png?url'

/**
 * macOS-ish wallpaper background.
 * Uses `desktop/macintosh-desktop.png` (bundled by Vite), with subtle movement unless reduced-motion.
 */
export function Wallpaper() {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      aria-hidden="true"
      className="absolute inset-0"
      initial={false}
      animate={
        reduceMotion
          ? undefined
          : {
              backgroundPosition: ['50% 45%', '50% 55%'],
            }
      }
      transition={
        reduceMotion
          ? undefined
          : {
              duration: 22,
              ease: 'linear',
              repeat: Infinity,
              repeatType: 'mirror',
            }
      }
      style={{
        backgroundImage: [
          `url(${wallpaperUrl})`,
          // Light, authentic-ish overlay to help legibility of UI chrome.
          'radial-gradient(120% 90% at 30% 15%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 55%)',
          'linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.30) 100%)',
        ].join(','),
        backgroundRepeat: 'no-repeat, no-repeat, no-repeat',
        backgroundSize: 'cover, cover, cover',
        backgroundPosition: '50% 50%',
      }}
    >
      {/* subtle vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_30%,rgba(255,255,255,0.08)_0%,rgba(0,0,0,0.45)_70%,rgba(0,0,0,0.65)_100%)]" />
      {/* light grain */}
      <div
        className="absolute inset-0 opacity-[0.065] mix-blend-overlay"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27160%27 height=%27160%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27160%27 height=%27160%27 filter=%27url(%23n)%27 opacity=%270.55%27/%3E%3C/svg%3E")',
          backgroundSize: '240px 240px',
        }}
      />
    </motion.div>
  )
}

