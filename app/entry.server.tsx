import {ServerRouter} from 'react-router';
import {isbot} from 'isbot';
import {renderToReadableStream} from 'react-dom/server';
import {
  createContentSecurityPolicy,
  type HydrogenRouterContextProvider,
} from '@shopify/hydrogen';
import type {EntryContext} from 'react-router';

// Minimal ambient declaration for Cloudflare Workers' HTMLRewriter, which
// Oxygen's edge runtime provides but isn't in the default TS lib and
// pulling the full @cloudflare/workers-types conflicts with Hydrogen's.
interface HRElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
}
interface HRHandlers {
  element?: (element: HRElement) => void;
}
declare class HTMLRewriter {
  on(selector: string, handlers: HRHandlers): HTMLRewriter;
  transform(response: Response): Response;
}

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
  context: HydrogenRouterContextProvider,
) {
  const {nonce, header, NonceProvider} = createContentSecurityPolicy({
    shop: {
      checkoutDomain: context.env.PUBLIC_CHECKOUT_DOMAIN,
      storeDomain: context.env.PUBLIC_STORE_DOMAIN,
    },
    // Turnstile injects a script from challenges.cloudflare.com and renders
    // the challenge UI inside an iframe served from the same host. Without
    // these directives Hydrogen's default CSP drops both and the support
    // widget shows "Could not verify you are human".
    //
    // IMPORTANT: Hydrogen's createContentSecurityPolicy REPLACES each
    // directive with the list you pass — it does not merge. So we have
    // to include the Hydrogen defaults (`self`, the nonce placeholder,
    // cdn.shopify.com) explicitly, or the JS bundles served from that
    // CDN stop loading and the whole site stays in SSR-only mode.
    scriptSrc: [
      "'self'",
      'https://cdn.shopify.com',
      'https://challenges.cloudflare.com',
    ],
    frameSrc: ["'self'", 'https://challenges.cloudflare.com'],
    connectSrc: [
      "'self'",
      'https://cdn.shopify.com',
      'https://monorail-edge.shopifysvc.com',
      `https://${context.env.PUBLIC_STORE_DOMAIN}`,
      'https://challenges.cloudflare.com',
    ],
  });

  const body = await renderToReadableStream(
    <NonceProvider>
      <ServerRouter
        context={reactRouterContext}
        url={request.url}
        nonce={nonce}
      />
    </NonceProvider>,
    {
      nonce,
      signal: request.signal,
      onError(error) {
        console.error(error);
        responseStatusCode = 500;
      },
    },
  );

  if (isbot(request.headers.get('user-agent'))) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');
  responseHeaders.set('Content-Security-Policy', header);
  responseHeaders.set('X-Content-Type-Options', 'nosniff');
  responseHeaders.set('X-Frame-Options', 'DENY');
  responseHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  responseHeaders.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self), usb=(), interest-cohort=()',
  );
  if (new URL(request.url).protocol === 'https:') {
    responseHeaders.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    );
  }
  responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

  // Oxygen's asset CDN serves cross-origin module bundles (cdn.shopify.com),
  // and Chrome treats a <link rel="modulepreload"> without a crossorigin
  // attribute as credentialed — which the CDN rejects with 503 during the
  // window where a previous deployment's assets are being evicted. Force
  // crossorigin="anonymous" on every module script/preload so the preload
  // fetch matches the module fetch and the cached response is reused.
  const response = new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });

  return new HTMLRewriter()
    .on('link[rel="modulepreload"]', {
      element(el) {
        if (!el.getAttribute('crossorigin')) {
          el.setAttribute('crossorigin', 'anonymous');
        }
      },
    })
    .on('script[type="module"]', {
      element(el) {
        if (!el.getAttribute('crossorigin')) {
          el.setAttribute('crossorigin', 'anonymous');
        }
      },
    })
    .transform(response);
}
