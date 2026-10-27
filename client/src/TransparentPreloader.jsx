import { useEffect, useState } from 'react';

/**
 * Transparent AttendTrack Preloader
 *
 * - Fully transparent background (no black, white, tinted, or blurred overlay).
 * - Original DJSCE college crest centered on screen with preserved asset and colors.
 * - Subtle horizontal light sweep clipped strictly to the crest via CSS mask.
 * - Plays once for ~3 seconds on initial website launch in a browser session.
 * - Hidden for the remainder of the session (tracked in sessionStorage).
 */
export default function TransparentPreloader({ onComplete }) {
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    // Start smooth fade-out at 2400ms to finish right at 3000ms
    const fadeTimer = setTimeout(() => {
      setFadingOut(true);
    }, 2400);

    const endTimer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 3000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(endTimer);
    };
  }, [onComplete]);

  return (
    <aside
      className={`transparent-preloader-overlay ${fadingOut ? 'fade-out' : ''}`}
      aria-label="Loading AttendTrack"
      role="status"
      aria-live="polite"
    >
      <div className="preloader-crest-center">
        <div className="preloader-crest-stage">
          {/* Base Crest Image with original DJSCE colors */}
          <img
            src="/djsce_crest.png"
            alt="Dwarkadas J. Sanghvi College of Engineering Crest"
            className="preloader-crest-img"
          />

          {/* Light Sweep Shimmer Mask: Clipped strictly to the crest contour */}
          <div className="preloader-crest-sweep-mask" aria-hidden="true">
            <div className="preloader-sweep-beam" />
          </div>
        </div>
      </div>
    </aside>
  );
}
