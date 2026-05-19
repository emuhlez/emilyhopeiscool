/**
 * Tier 2 Liquid Glass: SVG <defs> that produce an edge-refraction filter.
 *
 * Strategy: fractal noise → blur → displacement map. Applied via
 * `filter: url(#photos-lg-edge)` on glass pills so content visible behind
 * the pill bends at the edges (the "liquid" half of Liquid Glass that
 * `backdrop-filter: blur()` alone can't reproduce).
 *
 * macOS Tahoe ref: Photos toolbar is the showcase surface for this effect.
 */
export function LiquidGlassDefs() {
  return (
    <svg
      aria-hidden
      width="0"
      height="0"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <defs>
        {/* Subtle refraction. Low-frequency turbulence + small displacement
            keeps pill edges crisp while still bending pixels just enough to
            read as glass instead of frosted plastic. */}
        <filter
          id="photos-lg-edge"
          x="-6%"
          y="-20%"
          width="112%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.006 0.010"
            numOctaves="1"
            seed="7"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="2.2" result="softNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="softNoise"
            scale="1.5"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        <filter
          id="photos-lg-edge-strong"
          x="-6%"
          y="-22%"
          width="112%"
          height="144%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.008 0.012"
            numOctaves="1"
            seed="11"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="2" result="softNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="softNoise"
            scale="2.2"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* Tall sidebar: very low-frequency turbulence so refraction reads as one
            slow vertical wave, not repeating stripes; slightly stronger
            displacement than toolbar pills since there's no crisp rim to judge by. */}
        <filter
          id="photos-lg-sidebar"
          x="-4%"
          y="-4%"
          width="108%"
          height="108%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.003 0.0045"
            numOctaves="1"
            seed="19"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="2.8" result="softNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="softNoise"
            scale="8"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  )
}
