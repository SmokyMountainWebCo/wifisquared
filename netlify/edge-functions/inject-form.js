export default async (request, context) => {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;

  let html = await response.text();
  if (html.includes('/form-upgrade.js')) {
    return new Response(html, {
      status: response.status,
      headers: response.headers
    });
  }

  html = html.replace('</body>', '<script src="/form-upgrade.js"></script>\n</body>');
  return new Response(html, {
    status: response.status,
    headers: response.headers
  });
};
