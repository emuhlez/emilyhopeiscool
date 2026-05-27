import { publicUrl } from './assetUrl'

/**
 * Dynamically inject @font-face rules using base-aware URLs.
 * CSS `url('/fonts/...')` breaks when deployed with a non-root base path (e.g. GitHub Pages).
 * This injects them from JS so `publicUrl()` can resolve the correct path.
 */
export function loadFonts(): void {
  const builderSansWeights = [
    { weight: 100, file: 'BuilderSans-Thin.otf' },
    { weight: 300, file: 'BuilderSans-Light.otf' },
    { weight: 400, file: 'BuilderSans-Regular.otf' },
    { weight: 500, file: 'BuilderSans-Medium.otf' },
    { weight: 600, file: 'BuilderSans-SemiBold.otf' },
    { weight: 700, file: 'BuilderSans-Bold.otf' },
    { weight: 800, file: 'BuilderSans-ExtraBold.otf' },
  ]

  const builderMonoWeights = [
    { weight: 300, file: 'builder-mono/BuilderMono-Light.otf' },
    { weight: 400, file: 'builder-mono/BuilderMono-Regular.otf' },
    { weight: 700, file: 'builder-mono/BuilderMono-Bold.otf' },
  ]

  const rules = [
    ...builderSansWeights.map(
      ({ weight, file }) =>
        `@font-face { font-family: 'BuilderSans'; src: url('${publicUrl(`fonts/${file}`)}') format('opentype'); font-weight: ${weight}; font-style: normal; font-display: swap; }`,
    ),
    ...builderMonoWeights.map(
      ({ weight, file }) =>
        `@font-face { font-family: 'BuilderMono'; src: url('${publicUrl(`fonts/${file}`)}') format('opentype'); font-weight: ${weight}; font-style: normal; font-display: swap; }`,
    ),
  ]

  const style = document.createElement('style')
  style.textContent = rules.join('\n')
  document.head.prepend(style)
}
