import type {Route} from './+types/account_.logout';

// Both GET and POST invalidate the session. The previous loader simply
// returned redirect('/') without calling customerAccount.logout(),
// meaning any anchor-tag rendering of /account/logout (or a forced GET
// via prefetch) appeared to log the user out but actually left both the
// Shopify and local session cookies alive. Always go through
// customerAccount.logout() so the OAuth end-session call + local
// session.destroy() both run.
export async function loader({context}: Route.LoaderArgs) {
  return context.customerAccount.logout();
}

export async function action({context}: Route.ActionArgs) {
  return context.customerAccount.logout();
}
