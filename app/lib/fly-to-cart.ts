/**
 * Add-to-cart flourish: a thumbnail of the product arcs from the buy button
 * into the header cart icon, which then pulses. Pure DOM + Web Animations API
 * (no CSS dependency, no React state) so it works from any click handler and
 * cleans itself up. No-op under reduced motion, off-screen, or when the cart
 * target isn't mounted (e.g. SSR).
 */
export function flyToCart(from: DOMRect, imageUrl?: string | null) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const target = document.querySelector<HTMLElement>('[data-cart-target]');
  if (!target) return;
  const to = target.getBoundingClientRect();

  const size = 60;
  const startX = from.left + from.width / 2;
  const startY = from.top + from.height / 2;
  const endX = to.left + to.width / 2;
  const endY = to.top + to.height / 2;
  const dx = endX - startX;
  const dy = endY - startY;

  const puck = document.createElement('div');
  puck.setAttribute('aria-hidden', 'true');
  Object.assign(puck.style, {
    position: 'fixed',
    left: `${startX - size / 2}px`,
    top: `${startY - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '16px',
    overflow: 'hidden',
    zIndex: '2000',
    pointerEvents: 'none',
    background: imageUrl ? '#fff' : 'var(--color-gold, #b8922e)',
    boxShadow: '0 12px 32px -10px rgba(0,0,0,0.55)',
    willChange: 'transform, opacity',
  } satisfies Partial<CSSStyleDeclaration>);

  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = '';
    Object.assign(img.style, {
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      display: 'block',
    } satisfies Partial<CSSStyleDeclaration>);
    puck.appendChild(img);
  }

  document.body.appendChild(puck);

  // Arc: lift up first, then drop into the cart while shrinking and fading.
  const anim = puck.animate(
    [
      {transform: 'translate(0px, 0px) scale(1)', opacity: 1, offset: 0},
      {
        transform: `translate(${dx * 0.45}px, ${dy * 0.4 - 60}px) scale(0.75)`,
        opacity: 1,
        offset: 0.6,
      },
      {
        transform: `translate(${dx}px, ${dy}px) scale(0.15)`,
        opacity: 0.3,
        offset: 1,
      },
    ],
    {duration: 680, easing: 'cubic-bezier(0.55, 0, 0.85, 0.25)'},
  );

  anim.onfinish = () => {
    puck.remove();
    // Acknowledge arrival with a quick pop on the cart icon.
    target.animate(
      [
        {transform: 'scale(1)'},
        {transform: 'scale(1.28)'},
        {transform: 'scale(1)'},
      ],
      {duration: 320, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'},
    );
  };
}
