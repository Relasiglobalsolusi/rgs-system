/** Shared Projects directory query builder — safe for client and server. */
export function buildProjectsHref(opts: {
  clientId?: string;
  view?: string;
  area?: string;
  sub?: string;
}) {
  const params = new URLSearchParams();
  if (opts.clientId) params.set("clientId", opts.clientId);
  if (opts.view) params.set("view", opts.view);
  if (opts.area && opts.area !== "all") params.set("area", opts.area);
  if (opts.sub) params.set("sub", opts.sub);
  const query = params.toString();
  return query ? `/projects?${query}` : "/projects";
}
