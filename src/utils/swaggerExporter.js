// Converts an internal app collection into an OpenAPI 3.0.0 spec object.
// The resulting object can be serialised as JSON or YAML by the caller.

export function exportToOpenAPI(collection, overrides = {}) {
  const serverUrl = overrides.serverUrl ?? inferServerUrl(collection);
  const paths = {};

  collectPaths(collection.items ?? [], paths);

  const spec = {
    openapi: '3.0.0',
    info: {
      title: collection.name || 'API',
      description: collection.description || '',
      version: overrides.version || '1.0.0',
    },
    ...(serverUrl ? { servers: [{ url: serverUrl }] } : {}),
    paths,
  };

  return spec;
}

// ─── Path collection ─────────────────────────────────────────────────────────

function collectPaths(items, paths) {
  for (const item of items) {
    if (item.type === 'folder') {
      collectPaths(item.items ?? [], paths);
    } else if (item.type === 'request' && item.request?.url) {
      addOperation(paths, item.name, item.request);
    }
  }
}

function addOperation(paths, name, req) {
  const { pathStr, serverUrl } = splitUrl(req.url || '');
  if (!pathStr) return;

  const method = (req.method || 'GET').toLowerCase();
  if (!paths[pathStr]) paths[pathStr] = {};

  const parameters = buildParameters(req);

  const operation = {
    summary: name,
    operationId: slugify(name),
    ...(parameters.length ? { parameters } : {}),
    responses: { '200': { description: 'OK' } },
  };

  // Request body
  const rb = buildRequestBody(req);
  if (rb) operation.requestBody = rb;

  // Tags from path
  const tag = firstTag(pathStr);
  if (tag) operation.tags = [tag];

  paths[pathStr][method] = operation;
}

// ─── Parameters ──────────────────────────────────────────────────────────────

function buildParameters(req) {
  const params = [];

  // Path params derived from {variable} tokens in URL
  const pathParams = [...(req.url || '').matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  for (const name of pathParams) {
    params.push({ name, in: 'path', required: true, schema: { type: 'string' } });
  }

  // Query params
  for (const { key, value, enabled } of req.params || []) {
    if (!key || !enabled) continue;
    params.push({
      name: key,
      in: 'query',
      required: false,
      schema: { type: 'string' },
      ...(value ? { example: value } : {}),
    });
  }

  // Headers (skip standard ones auto-added by the HTTP client)
  const SKIP_HEADERS = new Set(['content-type', 'accept', 'authorization']);
  for (const { key, value, enabled } of req.headers || []) {
    if (!key || !enabled || SKIP_HEADERS.has(key.toLowerCase())) continue;
    params.push({
      name: key,
      in: 'header',
      required: false,
      schema: { type: 'string' },
      ...(value ? { example: value } : {}),
    });
  }

  return params;
}

// ─── Request body ─────────────────────────────────────────────────────────────

function buildRequestBody(req) {
  if (req.bodyType === 'none' || !req.bodyType) return null;

  if (req.bodyType === 'json') {
    let schema = { type: 'object' };
    let example;
    try {
      const parsed = JSON.parse(req.bodyRaw || '');
      schema = inferSchema(parsed);
      example = parsed;
    } catch {
      // bodyRaw wasn't valid JSON – leave schema as generic object
    }
    return {
      required: true,
      content: {
        'application/json': {
          schema,
          ...(example !== undefined ? { example } : {}),
        },
      },
    };
  }

  if (req.bodyType === 'raw') {
    return {
      content: { 'text/plain': { schema: { type: 'string' } } },
    };
  }

  if (req.bodyType === 'form') {
    const properties = {};
    for (const { key, value, enabled } of req.bodyForm || []) {
      if (!key || !enabled) continue;
      properties[key] = { type: 'string', ...(value ? { example: value } : {}) };
    }
    return {
      content: {
        'application/x-www-form-urlencoded': {
          schema: { type: 'object', properties },
        },
      },
    };
  }

  return null;
}

// ─── Schema inference ─────────────────────────────────────────────────────────

function inferSchema(value) {
  if (value === null) return { type: 'string', nullable: true };
  if (typeof value === 'boolean') return { type: 'boolean', example: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { type: 'integer', format: 'int64', example: value }
      : { type: 'number', format: 'double', example: value };
  }
  if (typeof value === 'string') {
    const schema = { type: 'string', example: value };
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) schema.format = 'date-time';
    else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) schema.format = 'date';
    else if (/^[\w.-]+@[\w.-]+\.\w+$/.test(value)) schema.format = 'email';
    return schema;
  }
  if (Array.isArray(value)) {
    return {
      type: 'array',
      items: value.length ? inferSchema(value[0]) : { type: 'string' },
    };
  }
  if (typeof value === 'object') {
    const properties = {};
    for (const [k, v] of Object.entries(value)) {
      properties[k] = inferSchema(v);
    }
    return { type: 'object', properties };
  }
  return { type: 'string' };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function splitUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    return {
      pathStr: u.pathname || '/',
      serverUrl: `${u.protocol}//${u.host}`,
    };
  } catch {
    // Not a full URL – treat as a path
    return { pathStr: rawUrl || '/', serverUrl: '' };
  }
}

function inferServerUrl(collection) {
  // Look at the first request URL and extract the origin
  for (const item of collection.items ?? []) {
    const url = findFirstUrl(item);
    if (url) {
      try {
        const u = new URL(url);
        return `${u.protocol}//${u.host}`;
      } catch { /* skip */ }
    }
  }
  return '';
}

function findFirstUrl(item) {
  if (item.type === 'request') return item.request?.url ?? '';
  for (const child of item.items ?? []) {
    const url = findFirstUrl(child);
    if (url) return url;
  }
  return '';
}

function firstTag(pathStr) {
  const parts = pathStr.split('/').filter(Boolean);
  const nonVersion = parts.find((p) => !/^(api|v\d+(\.\d+)?)$/i.test(p));
  return nonVersion?.replace(/[{}]/g, '') ?? null;
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
