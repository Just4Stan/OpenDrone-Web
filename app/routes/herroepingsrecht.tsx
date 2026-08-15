import {data, useLoaderData, Form, useActionData, useNavigation} from 'react-router';
import type {Route} from './+types/herroepingsrecht';
import {LegalPage} from '~/components/LegalPage';
import {alternateLocaleTags, legalLabels, resolveLegalLoader, seoLocaleTag} from '~/lib/i18n';
import {buildSeoMeta} from '~/lib/seo';
import {checkRateLimit, clientIp} from '~/lib/rate-limit';
import {sendWithdrawalNotice, type WithdrawalNotice} from '~/lib/withdrawal-email';

export const meta: Route.MetaFunction = ({data: loaderData}) => {
  const locale = loaderData?.locale ?? 'en';
  const labels = legalLabels('herroepingsrecht', locale);
  return buildSeoMeta({
    title: labels.title,
    description: labels.description,
    locale: seoLocaleTag(locale),
    alternateLocales: alternateLocaleTags(locale),
    canonical: loaderData?.canonicalUrl,
    hreflang: loaderData?.hreflang,
  });
};

export async function loader({request}: Route.LoaderArgs) {
  return resolveLegalLoader(
    request,
    'herroepingsformulier',
    'herroepingsrecht',
  );
}

type WithdrawResult = {ok: boolean; message?: string};

/**
 * Online withdrawal function (Directive (EU) 2023/2673 Art. 11a via Art.
 * VI.49/1 WER): consumers must be able to withdraw through the website with
 * a confirmation of receipt on a durable medium. The action emails the shop
 * and sends the consumer a confirmation email.
 */
export async function action({request, context}: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return data<WithdrawResult>({ok: false, message: 'Method not allowed.'}, {status: 405});
  }
  const env = context.env as Record<string, string | undefined>;
  const form = await request.formData();

  // Honeypot: real users never fill this hidden field.
  if (String(form.get('website') || '') !== '') {
    return data<WithdrawResult>({ok: true});
  }

  const ip = clientIp(request);
  const limited = checkRateLimit(`withdraw:${ip}`, 5, 60 * 60 * 1000);
  if (!limited.allowed) {
    return data<WithdrawResult>(
      {ok: false, message: 'Too many submissions. Please try again later or email contact@opendrone.be.'},
      {status: 429},
    );
  }

  const locale = (['nl', 'en', 'fr'] as const).find(
    (l) => l === String(form.get('locale') || ''),
  ) ?? 'en';
  const notice: WithdrawalNotice = {
    name: String(form.get('name') || '').trim().slice(0, 200),
    email: String(form.get('email') || '').trim().slice(0, 200),
    orderNumber: String(form.get('order') || '').trim().slice(0, 100),
    products: String(form.get('products') || '').trim().slice(0, 1000),
    receivedOn: String(form.get('received') || '').trim().slice(0, 40),
    remarks: String(form.get('remarks') || '').trim().slice(0, 2000),
    locale,
  };

  if (!notice.name || !notice.email.includes('@') || !notice.orderNumber || !notice.products) {
    return data<WithdrawResult>(
      {ok: false, message: 'Please fill in name, email, order number and products.'},
      {status: 400},
    );
  }

  await sendWithdrawalNotice(env, notice);
  return data<WithdrawResult>({ok: true});
}

const FORM_COPY = {
  nl: {
    heading: 'Herroeping online indienen',
    intro: 'Vul dit formulier in om uw herroeping rechtstreeks via de website in te dienen. U ontvangt per e-mail een ontvangstbevestiging.',
    name: 'Naam',
    email: 'E-mailadres',
    order: 'Bestelnummer',
    products: 'Product(en) waarop de herroeping betrekking heeft',
    received: 'Ontvangen op (datum)',
    remarks: 'Opmerkingen (optioneel)',
    submit: 'Herroeping indienen',
    submitting: 'Versturen…',
    done: 'Uw herroeping is ingediend. U ontvangt binnen enkele minuten een ontvangstbevestiging per e-mail.',
  },
  en: {
    heading: 'Submit your withdrawal online',
    intro: 'Use this form to submit your withdrawal directly through the website. You will receive a confirmation of receipt by email.',
    name: 'Name',
    email: 'Email address',
    order: 'Order number',
    products: 'Product(s) the withdrawal concerns',
    received: 'Received on (date)',
    remarks: 'Remarks (optional)',
    submit: 'Submit withdrawal',
    submitting: 'Sending…',
    done: 'Your withdrawal has been submitted. A confirmation of receipt will arrive by email within a few minutes.',
  },
  fr: {
    heading: 'Exercer votre rétractation en ligne',
    intro: 'Utilisez ce formulaire pour exercer votre rétractation directement via le site. Vous recevrez une confirmation de réception par courriel.',
    name: 'Nom',
    email: 'Adresse électronique',
    order: 'Numéro de commande',
    products: 'Produit(s) concerné(s) par la rétractation',
    received: 'Reçu le (date)',
    remarks: 'Remarques (facultatif)',
    submit: 'Envoyer la rétractation',
    submitting: 'Envoi…',
    done: 'Votre rétractation a été envoyée. Une confirmation de réception vous parviendra par courriel dans quelques minutes.',
  },
} as const;

function WithdrawalForm({locale}: {locale: 'nl' | 'en' | 'fr'}) {
  const copy = FORM_COPY[locale];
  const result = useActionData<WithdrawResult>();
  const nav = useNavigation();
  const busy = nav.state !== 'idle';

  if (result?.ok) {
    return (
      <div className="rich-content mt-10 rounded border border-[var(--color-border)] p-6">
        <p>{copy.done}</p>
      </div>
    );
  }

  const field =
    'w-full rounded border border-[var(--color-border)] bg-transparent px-3 py-2 text-[var(--color-text)]';
  return (
    <Form method="post" className="mt-10 max-w-xl space-y-4">
      <h2 className="font-mono text-[13px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
        {copy.heading}
      </h2>
      <p className="text-sm text-[var(--color-text-muted)]">{copy.intro}</p>
      {result?.message ? (
        <p className="text-sm text-red-500" role="alert">{result.message}</p>
      ) : null}
      <input type="hidden" name="locale" value={locale} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <label className="block text-sm">
        {copy.name}
        <input required name="name" className={field} autoComplete="name" />
      </label>
      <label className="block text-sm">
        {copy.email}
        <input required type="email" name="email" className={field} autoComplete="email" />
      </label>
      <label className="block text-sm">
        {copy.order}
        <input required name="order" className={field} />
      </label>
      <label className="block text-sm">
        {copy.products}
        <input required name="products" className={field} />
      </label>
      <label className="block text-sm">
        {copy.received}
        <input type="date" name="received" className={field} />
      </label>
      <label className="block text-sm">
        {copy.remarks}
        <textarea name="remarks" rows={3} className={field} />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-[var(--color-accent)] px-5 py-2 font-mono text-[13px] uppercase tracking-[0.15em] text-[var(--color-on-accent)] disabled:opacity-50"
      >
        {busy ? copy.submitting : copy.submit}
      </button>
    </Form>
  );
}

export default function HerroepingsrechtRoute() {
  const {html, locale} = useLoaderData<typeof loader>();
  const labels = legalLabels('herroepingsrecht', locale);
  return (
    <LegalPage
      eyebrow={labels.eyebrow}
      title={labels.title}
      html={html}
      locale={locale}
    >
      <WithdrawalForm locale={locale} />
    </LegalPage>
  );
}
