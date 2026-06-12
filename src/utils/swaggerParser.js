// Converts an OpenAPI 2.0 (Swagger) or OpenAPI 3.0 spec object
// into the app's internal collection format.

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

export function parseSwaggerSpec(spec) {
  if (!spec || typeof spec !== 'object') {
    throw new Error('Invalid spec: expected an object');
  }

  const isV2 = spec.swagger === '2.0';
  const isV3 = typeof spec.openapi === 'string' && spec.openapi.startsWith('3.');

  if (!isV2 && !isV3) {
    throw new Error(
      'Unsupported format. Expected "swagger: 2.0" or "openapi: 3.x.x".'
    );
  }

  const title = spec.info?.title || 'Imported API';
  const baseUrl = isV3 ? resolveV3BaseUrl(spec) : resolveV2BaseUrl(spec);

  // Group operations into folders by the first path segment
  const folderMap = new Map();

  for (const [pathTemplate, pathItem] of Object.entries(spec.paths || {})) {
    const folderKey = firstSegment(pathTemplate);

    if (!folderMap.has(folderKey)) {
      folderMap.set(folderKey, {
        type: 'folder',
        name: capitalize(folderKey),
        items: [],
      });
    }

    const folder = folderMap.get(folderKey);

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;

      const name =
        operation.summary ||
        operation.operationId ||
        `${method.toUpperCase()} ${pathTemplate}`;

      const request = buildRequest(
        method,
        baseUrl,
        pathTemplate,
        operation,
        pathItem,
        isV3
      );

      folder.items.push({ type: 'request', name, request });
    }
  }

  return {
    _id: crypto.randomUUID(),
    name: title,
    description: spec.info?.description || '',
    items: [...folderMap.values()],
    _source: 'swagger',
  };
}

// ─── URL resolution ────────────────────────────────────────────────────────────

function resolveV2BaseUrl(spec) {
  const scheme = spec.schemes?.[0] ?? 'https';
  const host = spec.host ?? '';
  const base = (spec.basePath ?? '/').replace(/\/$/, '');
  return host ? `${scheme}://${host}${base}` : base;
}

function resolveV3BaseUrl(spec) {
  const first = spec.servers?.[0]?.url ?? '';
  return first.replace(/\/$/, '');
}

// ─── Request builder ──────────────────────────────────────────────────────────

function buildRequest(method, baseUrl, pathTemplate, operation, pathItem, isV3) {
  // Merge path-level and operation-level parameters (operation takes precedence)
  const pathParams = pathItem.parameters || [];
  const opParams = operation.parameters || [];
  const allParams = mergeParams(pathParams, opParams);

  const queryParams = allParams
    .filter((p) => p.in === 'query')
    .map((p) => ({
      key: p.name,
      value: String(p.example ?? p.default ?? ''),
      enabled: true,
    }));

  const headers = allParams
    .filter((p) => p.in === 'header')
    .map((p) => ({
      key: p.name,
      value: String(p.example ?? p.default ?? ''),
      enabled: true,
    }));

  // Body
  let bodyType = 'none';
  let bodyRaw = '';

  if (isV3) {
    const rb = operation.requestBody;
    if (rb) {
      const jsonContent = rb.content?.['application/json'];
      const formContent = rb.content?.['application/x-www-form-urlencoded'];
      if (jsonContent) {
        bodyType = 'json';
        bodyRaw = schemaToExampleJson(jsonContent.schema);
      } else if (formContent) {
        bodyType = 'form';
      } else {
        bodyType = 'raw';
      }
    }
  } else {
    // OpenAPI 2.0: body parameter
    const bodyParam = allParams.find((p) => p.in === 'body');
    if (bodyParam?.schema) {
      bodyType = 'json';
      bodyRaw = schemaToExampleJson(bodyParam.schema);
    } else {
      // formData parameters
      const formParams = allParams.filter((p) => p.in === 'formData');
      if (formParams.length) bodyType = 'form';
    }
  }

  return {
    method: method.toUpperCase(),
    url: `${baseUrl}${pathTemplate}`,
    params: [...queryParams, { key: '', value: '', enabled: true }],
    headers: [...headers, { key: '', value: '', enabled: true }],
    bodyType,
    bodyRaw,
    bodyForm: [{ key: '', value: '', enabled: true }],
    auth: { type: 'none', token: '', username: '', password: '', key: '', value: '', in: 'header' },
  };
}

// Operation-level params shadow path-level params with the same name+in
function mergeParams(pathLevel, opLevel) {
  const map = new Map(pathLevel.map((p) => [`${p.name}:${p.in}`, p]));
  for (const p of opLevel) map.set(`${p.name}:${p.in}`, p);
  return [...map.values()];
}

// ─── Schema → example JSON ────────────────────────────────────────────────────

function schemaToExampleJson(schema) {
  const value = buildExample(schema, 0);
  if (value === null || value === undefined) return '';
  return JSON.stringify(value, null, 2);
}

function buildExample(schema, depth) {
  if (!schema || depth > 4) return null;

  // Honour explicit example/default
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum?.length) return schema.enum[0];

  // $ref: skip (would need a full resolver)
  if (schema.$ref) return null;

  switch (schema.type) {
    case 'object': {
      const obj = {};
      for (const [k, v] of Object.entries(schema.properties || {})) {
        obj[k] = buildExample(v, depth + 1);
      }
      return obj;
    }
    case 'array':
      return [buildExample(schema.items ?? {}, depth + 1)];
    case 'string':
      return schema.format === 'date-time'
        ? '2024-01-01T00:00:00Z'
        : schema.format === 'date'
        ? '2024-01-01'
        : schema.format === 'email'
        ? 'user@example.com'
        : schema.format === 'uuid'
        ? '00000000-0000-0000-0000-000000000000'
        : 'string';
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return true;
    default:
      // No explicit type — try to infer from properties
      if (schema.properties) return buildExample({ ...schema, type: 'object' }, depth);
      return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function firstSegment(pathTemplate) {
  // "/api/v1/users/{id}" → "users"  ("/api/v1/" prefix skipped if pure version segment)
  const parts = pathTemplate.split('/').filter(Boolean);
  // Skip leading version segments like "api", "v1", "v2"
  const nonVersion = parts.find((p) => !/^(api|v\d+(\.\d+)?)$/i.test(p)) ?? parts[0] ?? 'root';
  return nonVersion.replace(/[{}]/g, ''); // strip path param braces
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
