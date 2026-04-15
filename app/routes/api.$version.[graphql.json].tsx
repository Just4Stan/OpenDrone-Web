import type {Route} from './+types/api.$version.[graphql.json]';

export async function action({params, context, request}: Route.ActionArgs) {
  // Only forward safe headers to upstream
  const forwardHeaders = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) {
    forwardHeaders.set('content-type', contentType);
  }

  const response = await fetch(
    `https://${context.env.PUBLIC_CHECKOUT_DOMAIN}/api/${params.version}/graphql.json`,
    {
      method: 'POST',
      body: request.body,
      headers: forwardHeaders,
    },
  );

  return new Response(response.body, {
    status: response.status,
    headers: new Headers(response.headers),
  });
}
