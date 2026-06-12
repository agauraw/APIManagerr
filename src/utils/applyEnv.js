// Replace {{variableName}} tokens with environment variable values
export function applyEnv(str, env) {
  if (!str || !env?.variables?.length) return str;
  return str.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const v = env.variables.find((vr) => vr.key === key.trim());
    return v ? v.value : match;
  });
}

export function buildRequestConfig(request, env) {
  const ap = (s) => applyEnv(s, env);

  const resolvedUrl = ap(request.url);
  const [baseUrl] = resolvedUrl.split('?');

  const params = {};
  (request.params || []).forEach(({ key, value, enabled }) => {
    if (enabled && key) params[ap(key)] = ap(value);
  });

  const headers = {};
  (request.headers || []).forEach(({ key, value, enabled }) => {
    if (enabled && key) headers[ap(key)] = ap(value);
  });

  const auth = { ...request.auth };
  if (auth.token) auth.token = ap(auth.token);
  if (auth.username) auth.username = ap(auth.username);
  if (auth.password) auth.password = ap(auth.password);
  if (auth.value) auth.value = ap(auth.value);

  const bodyForm = (request.bodyForm || []).map(({ key, value, enabled }) => [
    ap(key),
    ap(value),
    enabled,
  ]);

  return {
    method: request.method,
    url: baseUrl,
    params,
    headers,
    auth,
    bodyType: request.bodyType,
    body: request.bodyType === 'form' ? bodyForm.filter(([k, , e]) => e && k) : ap(request.bodyRaw),
  };
}
