// Parses Postman Collection v2 / v2.1 into app's internal format

export function parseCollection(raw) {
  if (!raw?.info) throw new Error('Not a valid Postman collection');
  return {
    id: raw.info._postman_id || crypto.randomUUID(),
    name: raw.info.name,
    description: raw.info.description || '',
    items: parseItems(raw.item || []),
    _raw: raw,
  };
}

function parseItems(items) {
  return items.map((item) => {
    if (item.item) {
      // Folder
      return {
        type: 'folder',
        name: item.name,
        items: parseItems(item.item),
      };
    }
    // Request
    return {
      type: 'request',
      name: item.name,
      request: parseRequest(item.request || {}),
    };
  });
}

function parseRequest(req) {
  const url = parseUrl(req.url);
  const headers = parseKV(req.header || []);
  const { bodyType, bodyRaw, bodyForm } = parseBody(req.body);
  const auth = parseAuth(req.auth);

  return {
    method: (req.method || 'GET').toUpperCase(),
    url,
    params: parseParams(req.url),
    headers,
    bodyType,
    bodyRaw,
    bodyForm,
    auth,
  };
}

function parseUrl(url) {
  if (!url) return '';
  if (typeof url === 'string') return url;
  return url.raw || '';
}

function parseParams(url) {
  const base = [{ key: '', value: '', enabled: true }];
  if (!url) return base;
  const raw = typeof url === 'string' ? url : url.raw || '';
  const queryIndex = raw.indexOf('?');
  if (queryIndex === -1) return base;

  const queryStr = raw.slice(queryIndex + 1);
  const items = queryStr.split('&').map((pair) => {
    const [k, ...rest] = pair.split('=');
    return { key: decodeURIComponent(k), value: decodeURIComponent(rest.join('=')), enabled: true };
  });

  // Also parse from url.query array if present
  if (url?.query) {
    return [
      ...url.query.map((q) => ({ key: q.key, value: q.value || '', enabled: !q.disabled })),
      { key: '', value: '', enabled: true },
    ];
  }

  return [...items, { key: '', value: '', enabled: true }];
}

function parseKV(arr) {
  const items = arr.map((h) => ({ key: h.key || '', value: h.value || '', enabled: !h.disabled }));
  return [...items, { key: '', value: '', enabled: true }];
}

function parseBody(body) {
  if (!body || body.mode === 'none') return { bodyType: 'none', bodyRaw: '', bodyForm: [] };

  if (body.mode === 'raw') {
    const lang = body.options?.raw?.language || '';
    return {
      bodyType: lang === 'json' ? 'json' : 'raw',
      bodyRaw: body.raw || '',
      bodyForm: [],
    };
  }

  if (body.mode === 'urlencoded') {
    return {
      bodyType: 'form',
      bodyRaw: '',
      bodyForm: parseKV(body.urlencoded || []),
    };
  }

  if (body.mode === 'formdata') {
    return {
      bodyType: 'form',
      bodyRaw: '',
      bodyForm: parseKV(body.formdata || []),
    };
  }

  return { bodyType: 'none', bodyRaw: '', bodyForm: [] };
}

function parseAuth(auth) {
  const base = { type: 'none', token: '', username: '', password: '', key: '', value: '', in: 'header' };
  if (!auth || auth.type === 'noauth') return base;

  const kv = (arr) => Object.fromEntries((arr || []).map((i) => [i.key, i.value]));

  if (auth.type === 'bearer') {
    const data = kv(auth.bearer);
    return { ...base, type: 'bearer', token: data.token || '' };
  }
  if (auth.type === 'basic') {
    const data = kv(auth.basic);
    return { ...base, type: 'basic', username: data.username || '', password: data.password || '' };
  }
  if (auth.type === 'apikey') {
    const data = kv(auth.apikey);
    return { ...base, type: 'apikey', key: data.key || '', value: data.value || '', in: data.in || 'header' };
  }

  return base;
}

export function collectionToPostman(collection) {
  return {
    info: {
      name: collection.name,
      description: collection.description,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: itemsToPostman(collection.items || []),
  };
}

function itemsToPostman(items) {
  return items.map((item) => {
    if (item.type === 'folder') {
      return { name: item.name, item: itemsToPostman(item.items || []) };
    }
    const req = item.request || {};
    return {
      name: item.name,
      request: {
        method: req.method || 'GET',
        url: { raw: req.url || '' },
        header: (req.headers || [])
          .filter((h) => h.key)
          .map((h) => ({ key: h.key, value: h.value, disabled: !h.enabled })),
        body: requestBodyToPostman(req),
        auth: authToPostman(req.auth),
      },
    };
  });
}

function requestBodyToPostman(req) {
  if (req.bodyType === 'none') return { mode: 'none' };
  if (req.bodyType === 'json') return { mode: 'raw', raw: req.bodyRaw, options: { raw: { language: 'json' } } };
  if (req.bodyType === 'raw') return { mode: 'raw', raw: req.bodyRaw };
  if (req.bodyType === 'form') {
    return {
      mode: 'urlencoded',
      urlencoded: (req.bodyForm || [])
        .filter((f) => f.key)
        .map((f) => ({ key: f.key, value: f.value, disabled: !f.enabled })),
    };
  }
  return { mode: 'none' };
}

function authToPostman(auth) {
  if (!auth || auth.type === 'none') return { type: 'noauth' };
  if (auth.type === 'bearer') return { type: 'bearer', bearer: [{ key: 'token', value: auth.token, type: 'string' }] };
  if (auth.type === 'basic') {
    return {
      type: 'basic',
      basic: [
        { key: 'username', value: auth.username, type: 'string' },
        { key: 'password', value: auth.password, type: 'string' },
      ],
    };
  }
  if (auth.type === 'apikey') {
    return {
      type: 'apikey',
      apikey: [
        { key: 'key', value: auth.key, type: 'string' },
        { key: 'value', value: auth.value, type: 'string' },
        { key: 'in', value: auth.in, type: 'string' },
      ],
    };
  }
  return { type: 'noauth' };
}
