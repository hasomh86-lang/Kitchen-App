import{createRequire}from'module';const require=createRequire(import.meta.url);

// server/main.ts
import { createServer } from "node:http";
import { readFileSync as readFileSync2, readdirSync, existsSync as existsSync2, statSync, createReadStream, mkdirSync as mkdirSync2 } from "node:fs";
import { join as join2, resolve, extname, normalize, sep } from "node:path";
import { Readable } from "node:stream";

// node_modules/hono/dist/http-exception.js
var HTTPException = class extends Error {
  res;
  status;
  /**
  * Creates an instance of `HTTPException`.
  * @param status - HTTP status code for the exception. Defaults to 500.
  * @param options - Additional options for the exception.
  */
  constructor(status = 500, options) {
    super(options?.message, { cause: options?.cause });
    this.res = options?.res;
    this.status = status;
  }
  /**
  * Returns the response object associated with the exception.
  * If a response object is not provided, a new response is created with the error message and status code.
  * @returns The response object.
  */
  getResponse() {
    if (this.res) return new Response(this.res.body, {
      status: this.status,
      headers: this.res.headers
    });
    return new Response(this.message, { status: this.status });
  }
};

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = Symbol();

// node_modules/hono/dist/utils/buffer.js
var bufferToFormData = (arrayBuffer, contentType) => {
  return new Response(arrayBuffer, { headers: { "Content-Type": contentType.replace(/^[^;]+/, (mediaType) => mediaType.toLowerCase()) } }).formData();
};

// node_modules/hono/dist/utils/body.js
var MAX_NESTED_OBJECTS = 1e4;
var isRawRequest = (request) => "headers" in request;
var parseBody = async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const mediaType = (isRawRequest(request) ? request.headers : request.raw.headers).get("Content-Type")?.split(";")[0].trim().toLowerCase();
  if (mediaType === "multipart/form-data" || mediaType === "application/x-www-form-urlencoded") return parseFormData(request, {
    all,
    dot
  });
  return {};
};
async function parseFormData(request, options) {
  if (!isRawRequest(request) && request.bodyCache.formData) return convertFormDataToBodyData(await request.bodyCache.formData, options);
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const arrayBuffer = await request.arrayBuffer();
  const formDataPromise = bufferToFormData(arrayBuffer, headers.get("Content-Type") || "");
  if (!isRawRequest(request)) request.bodyCache.formData = formDataPromise;
  const formData = await formDataPromise;
  if (formData) return convertFormDataToBodyData(formData, options);
  return {};
}
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  const nestingState = { count: 0 };
  formData.forEach((value, key2) => {
    if (!(options.all || key2.endsWith("[]"))) form[key2] = value;
    else handleParsingAllValues(form, key2, value);
  });
  if (options.dot) Object.entries(form).forEach(([key2, value]) => {
    if (key2.includes(".")) {
      handleParsingNestedValues(form, key2, value, nestingState);
      delete form[key2];
    }
  });
  return form;
}
var handleParsingAllValues = (form, key2, value) => {
  if (form[key2] !== void 0) {
    if (Array.isArray(form[key2])) form[key2].push(value);
    else form[key2] = [form[key2], value];
  } else if (!key2.endsWith("[]")) form[key2] = value;
  else form[key2] = [value];
};
var handleParsingNestedValues = (form, key2, value, state) => {
  if (/(?:^|\.)__proto__\./.test(key2)) return;
  let nestedForm = form;
  const keys = key2.split(".", 34);
  if (keys.length > 33) throwNestingLimitExceeded();
  keys.forEach((key3, index) => {
    if (index === keys.length - 1) nestedForm[key3] = value;
    else {
      if (!nestedForm[key3] || typeof nestedForm[key3] !== "object" || Array.isArray(nestedForm[key3]) || nestedForm[key3] instanceof File) {
        if (state.count++ >= MAX_NESTED_OBJECTS) throwNestingLimitExceeded();
        nestedForm[key3] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key3];
    }
  });
};
var throwNestingLimitExceeded = () => {
  throw new Error("Nesting limit exceeded");
};

// node_modules/hono/dist/utils/url.js
var splitPath = (path) => {
  const paths = path.split("/");
  if (paths[0] === "") paths.shift();
  return paths;
};
var splitRoutingPath = (routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
};
var extractGroupsFromPath = (path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return {
    groups,
    path
  };
};
var replaceGroupMarks = (paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j2 = paths.length - 1; j2 >= 0; j2--) if (paths[j2].includes(mark)) {
      paths[j2] = paths[j2].replace(mark, groups[i][1]);
      break;
    }
  }
  return paths;
};
var patternCache = {};
var getPattern = (label, next) => {
  if (label === "*") return "*";
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [
        cacheKey,
        match2[1],
        new RegExp(`^${match2[2]}(?=/${next})`)
      ] : [
        label,
        match2[1],
        new RegExp(`^${match2[2]}$`)
      ];
      else patternCache[cacheKey] = [
        label,
        match2[1],
        true
      ];
    }
    return patternCache[cacheKey];
  }
  return null;
};
var tryDecode = (str2, decoder) => {
  try {
    return decoder(str2);
  } catch {
    return str2.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
};
var tryDecodeURI = (str2) => tryDecode(str2, decodeURI);
var getPath = (request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) break;
  }
  return url.slice(start, i);
};
var getPathNoStrict = (request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
};
var mergePath = (base, sub, ...rest) => {
  if (rest.length) sub = mergePath(sub, ...rest);
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
};
var checkOptionalParameter = (path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) return null;
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) basePath += "/" + segment;
    else if (/\:/.test(segment)) {
      if (segment.charCodeAt(segment.length - 1) === 63) {
        if (results.length === 0 && basePath === "") results.push("/");
        else results.push(basePath);
        const optionalSegment = segment.slice(0, -1);
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else basePath += "/" + segment;
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
};
var tryDecodeURIComponent = (str2) => str2.indexOf("%") !== -1 ? tryDecode(str2, decodeURIComponent_) : str2;
var _decodeURI = (value) => {
  if (value.indexOf("+") !== -1) value = value.replace(/\+/g, " ");
  return tryDecodeURIComponent(value);
};
var _getQueryParam = (url, key2, multiple) => {
  const hashIndex = url.indexOf("#", 8);
  if (hashIndex !== -1) url = url.slice(0, hashIndex);
  let encoded;
  if (!multiple && key2 && key2.indexOf("%") === -1 && key2.indexOf("+") === -1) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) return;
    if (!url.startsWith(key2, keyIndex2 + 1)) keyIndex2 = url.indexOf(`&${key2}`, keyIndex2 + 1);
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key2.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key2.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) return "";
      keyIndex2 = url.indexOf(`&${key2}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) return;
  }
  const results = /* @__PURE__ */ Object.create(null);
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) valueIndex = -1;
    let name = url.slice(keyIndex + 1, valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex);
    if (encoded) name = _decodeURI(name);
    keyIndex = nextKeyIndex;
    if (name === "") continue;
    let value;
    if (valueIndex === -1) value = "";
    else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) value = _decodeURI(value);
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) results[name] = [];
      results[name].push(value);
    } else results[name] ??= value;
  }
  return key2 ? results[key2] : results;
};
var getQueryParam = _getQueryParam;
var getQueryParams = (url, key2) => {
  return _getQueryParam(url, key2, true);
};
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var HonoRequest = class {
  /**
  * `.raw` can get the raw Request object.
  *
  * @see {@link https://hono.dev/docs/api/request#raw}
  *
  * @example
  * ```ts
  * // For Cloudflare Workers
  * app.post('/', async (c) => {
  *   const metadata = c.req.raw.cf?.hostMetadata?
  *   ...
  * })
  * ```
  */
  raw;
  #validatedData;
  #matchResult;
  routeIndex = 0;
  /**
  * `.path` can get the pathname of the request.
  *
  * @see {@link https://hono.dev/docs/api/request#path}
  *
  * @example
  * ```ts
  * app.get('/about/me', (c) => {
  *   const pathname = c.req.path // `/about/me`
  * })
  * ```
  */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
  }
  param(key2) {
    return key2 ? this.#getDecodedParam(key2) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key2) {
    const paramKey = this.#matchResult[0][this.routeIndex]?.[1][key2];
    const param = this.#getParamValue(paramKey);
    return param && tryDecodeURIComponent(param);
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex]?.[1] ?? {});
    for (const key2 of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key2]);
      if (value !== void 0) decoded[key2] = tryDecodeURIComponent(value);
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key2) {
    return getQueryParam(this.url, key2);
  }
  queries(key2) {
    return getQueryParams(this.url, key2);
  }
  header(name) {
    if (name) return this.raw.headers.get(name) ?? void 0;
    const headerData = /* @__PURE__ */ Object.create(null);
    this.raw.headers.forEach((value, key2) => {
      headerData[key2] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = (key2) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key2];
    if (cachedBody) return cachedBody;
    for (const anyCachedKey in bodyCache) return bodyCache[anyCachedKey].then((body) => {
      if (anyCachedKey === "json") body = JSON.stringify(body);
      const contentType = anyCachedKey === "formData" ? void 0 : raw2.headers.get("content-type");
      return new Response(body, { headers: contentType ? { "Content-Type": contentType } : void 0 })[key2]();
    });
    return bodyCache[key2] = raw2[key2]();
  };
  /**
  * `.json()` can parse Request body of type `application/json`
  *
  * @see {@link https://hono.dev/docs/api/request#json}
  *
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.json()
  * })
  * ```
  */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
  * `.text()` can parse Request body of type `text/plain`
  *
  * @see {@link https://hono.dev/docs/api/request#text}
  *
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.text()
  * })
  * ```
  */
  text() {
    return this.#cachedBody("text");
  }
  /**
  * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
  *
  * @see {@link https://hono.dev/docs/api/request#arraybuffer}
  *
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.arrayBuffer()
  * })
  * ```
  */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
  * `.bytes()` parses the request body as a `Uint8Array`.
  *
  * @see {@link https://hono.dev/docs/api/request#bytes}
  *
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.bytes()
  * })
  * ```
  */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
  * Parses the request body as a `Blob`.
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.blob();
  * });
  * ```
  * @see https://hono.dev/docs/api/request#blob
  */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
  * Parses the request body as `FormData`.
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.formData();
  * });
  * ```
  * @see https://hono.dev/docs/api/request#formdata
  */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
  * Adds validated data to the request.
  *
  * @param target - The target of the validation.
  * @param data - The validated data to add.
  */
  addValidatedData(target, data) {
    (this.#validatedData ??= {})[target] = data;
  }
  valid(target) {
    return this.#validatedData?.[target];
  }
  /**
  * `.url` can get the request url strings.
  *
  * @see {@link https://hono.dev/docs/api/request#url}
  *
  * @example
  * ```ts
  * app.get('/about/me', (c) => {
  *   const url = c.req.url // `http://localhost:8787/about/me`
  *   ...
  * })
  * ```
  */
  get url() {
    return this.raw.url;
  }
  /**
  * `.method` can get the method name of the request.
  *
  * @see {@link https://hono.dev/docs/api/request#method}
  *
  * @example
  * ```ts
  * app.get('/about/me', (c) => {
  *   const method = c.req.method // `GET`
  * })
  * ```
  */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
  * `.matchedRoutes` can return a matched route in the handler
  *
  * @deprecated
  *
  * Use matchedRoutes helper defined in "hono/route" instead.
  *
  * @see {@link https://hono.dev/docs/api/request#matchedroutes}
  *
  * @example
  * ```ts
  * app.use('*', async function logger(c, next) {
  *   await next()
  *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
  *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
  *     console.log(
  *       method,
  *       ' ',
  *       path,
  *       ' '.repeat(Math.max(10 - path.length, 0)),
  *       name,
  *       i === c.req.routeIndex ? '<- respond from here' : ''
  *     )
  *   })
  * })
  * ```
  */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
  * `.routePath` can retrieve the path registered within the handler
  *
  * @deprecated
  *
  * Use routePath helper defined in "hono/route" instead.
  *
  * @see {@link https://hono.dev/docs/api/request#routepath}
  *
  * @example
  * ```ts
  * app.get('/posts/:id', (c) => {
  *   return c.json({ path: c.req.routePath })
  * })
  * ```
  */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = (value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
};
var resolveCallback = async (str2, phase, preserveCallbacks, context, buffer) => {
  if (typeof str2 === "object" && !(str2 instanceof String)) {
    if (!(str2 instanceof Promise)) str2 = str2.toString();
    if (str2 instanceof Promise) str2 = await str2;
  }
  const callbacks = str2.callbacks;
  if (!callbacks?.length) return Promise.resolve(str2);
  if (buffer) buffer[0] += str2;
  else buffer = [str2];
  const resStr = Promise.all(callbacks.map((c) => c({
    phase,
    buffer,
    context
  }))).then((res) => Promise.all(res.filter(Boolean).map((str3) => resolveCallback(str3, phase, false, context, buffer))).then(() => buffer[0]));
  if (preserveCallbacks) return raw(await resStr, callbacks);
  else return resStr;
};

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = (contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
};
var createResponseInstance = (body, init) => new Response(body, init);
var Context = class {
  #rawRequest;
  #req;
  /**
  * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
  *
  * @see {@link https://hono.dev/docs/api/context#env}
  *
  * @example
  * ```ts
  * // Environment object for Cloudflare Workers
  * app.get('*', async c => {
  *   const counter = c.env.COUNTER
  * })
  * ```
  */
  env = {};
  #var;
  finalized = false;
  /**
  * `.error` can get the error object from the middleware if the Handler throws an error.
  *
  * @see {@link https://hono.dev/docs/api/context#error}
  *
  * @example
  * ```ts
  * app.use('*', async (c, next) => {
  *   await next()
  *   if (c.error) {
  *     // do something...
  *   }
  * })
  * ```
  */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
  * Creates an instance of the Context class.
  *
  * @param req - The Request object.
  * @param options - Optional configuration options for the context.
  */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
  * `.req` is the instance of {@link HonoRequest}.
  */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
  * @see {@link https://hono.dev/docs/api/context#event}
  * The FetchEvent associated with the current request.
  *
  * @throws Will throw an error if the context does not have a FetchEvent.
  */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) return this.#executionCtx;
    else throw Error("This context has no FetchEvent");
  }
  /**
  * @see {@link https://hono.dev/docs/api/context#executionctx}
  * The ExecutionContext associated with the current request.
  *
  * @throws Will throw an error if the context does not have an ExecutionContext.
  */
  get executionCtx() {
    if (this.#executionCtx) return this.#executionCtx;
    else throw Error("This context has no ExecutionContext");
  }
  /**
  * @see {@link https://hono.dev/docs/api/context#res}
  * The Response object for the current request.
  */
  get res() {
    return this.#res ||= createResponseInstance(null, { headers: this.#preparedHeaders ??= new Headers() });
  }
  /**
  * Sets the Response object for the current request.
  *
  * @param _res - The Response object to set.
  */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") continue;
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) _res.headers.append("set-cookie", cookie);
        } else _res.headers.set(k, v);
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
  * `.render()` can create a response within a layout.
  *
  * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
  *
  * @example
  * ```ts
  * app.get('/', (c) => {
  *   return c.render('Hello!')
  * })
  * ```
  */
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  /**
  * Sets the layout for the response.
  *
  * @param layout - The layout to set.
  * @returns The layout function.
  */
  setLayout = (layout) => this.#layout = layout;
  /**
  * Gets the current layout for the response.
  *
  * @returns The current layout function.
  */
  getLayout = () => this.#layout;
  /**
  * `.setRenderer()` can set the layout in the custom middleware.
  *
  * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
  *
  * @example
  * ```tsx
  * app.use('*', async (c, next) => {
  *   c.setRenderer((content) => {
  *     return c.html(
  *       <html>
  *         <body>
  *           <p>{content}</p>
  *         </body>
  *       </html>
  *     )
  *   })
  *   await next()
  * })
  * ```
  */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
  * `.header()` can set headers.
  *
  * @see {@link https://hono.dev/docs/api/context#header}
  *
  * @example
  * ```ts
  * app.get('/welcome', (c) => {
  *   // Set headers
  *   c.header('X-Message', 'Hello!')
  *   c.header('Content-Type', 'text/plain')
  *
  *   // Append multiple headers using the append option (e.g. Vary)
  *   c.header('Vary', 'Accept-Encoding', { append: true })
  *   c.header('Vary', 'User-Agent', { append: true })
  *
  *   return c.body('Thank you for coming')
  * })
  * ```
  */
  header = (name, value, options) => {
    if (this.finalized) this.#res = createResponseInstance(this.#res.body, this.#res);
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) headers.delete(name);
    else if (options?.append) headers.append(name, value);
    else headers.set(name, value);
  };
  status = (status) => {
    this.#status = status;
  };
  /**
  * `.set()` can set the value specified by the key.
  *
  * @see {@link https://hono.dev/docs/api/context#set-get}
  *
  * @example
  * ```ts
  * app.use('*', async (c, next) => {
  *   c.set('message', 'Hono is hot!!')
  *   await next()
  * })
  * ```
  */
  set = (key2, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key2, value);
  };
  /**
  * `.get()` can use the value specified by the key.
  *
  * @see {@link https://hono.dev/docs/api/context#set-get}
  *
  * @example
  * ```ts
  * app.get('/', (c) => {
  *   const message = c.get('message')
  *   return c.text(`The message is "${message}"`)
  * })
  * ```
  */
  get = (key2) => {
    return this.#var ? this.#var.get(key2) : void 0;
  };
  /**
  * `.var` can access the value of a variable.
  *
  * @see {@link https://hono.dev/docs/api/context#var}
  *
  * @example
  * ```ts
  * const result = c.var.client.oneMethod()
  * ```
  */
  get var() {
    if (!this.#var) return {};
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    let responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders;
    if (typeof arg === "object" && arg.headers) {
      responseHeaders ??= new Headers();
      for (const [key2, value] of new Headers(arg.headers)) if (key2 === "set-cookie") responseHeaders.append(key2, value);
      else responseHeaders.set(key2, value);
    }
    if (headers) {
      if (!responseHeaders) {
        let count = 0;
        for (const k in headers) if (++count > 1 || typeof headers[k] !== "string") {
          responseHeaders = new Headers();
          break;
        }
      }
      if (responseHeaders) for (const k in headers) {
        const v = headers[k];
        if (typeof v === "string") responseHeaders.set(k, v);
        else {
          responseHeaders.delete(k);
          for (const v2 of v) responseHeaders.append(k, v2);
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, {
      status,
      headers: responseHeaders ?? headers
    });
  }
  newResponse = (...args) => this.#newResponse(...args);
  /**
  * `.body()` can return the HTTP response.
  * You can set headers with `.header()` and set HTTP status code with `.status`.
  * This can also be set in `.text()`, `.json()` and so on.
  *
  * @see {@link https://hono.dev/docs/api/context#body}
  *
  * @example
  * ```ts
  * app.get('/welcome', (c) => {
  *   // Set headers
  *   c.header('X-Message', 'Hello!')
  *   c.header('Content-Type', 'text/plain')
  *   // Set HTTP status code
  *   c.status(201)
  *
  *   // Return the response body
  *   return c.body('Thank you for coming')
  * })
  * ```
  */
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  /**
  * `.text()` can render text as `Content-Type:text/plain`.
  *
  * @see {@link https://hono.dev/docs/api/context#text}
  *
  * @example
  * ```ts
  * app.get('/say', (c) => {
  *   return c.text('Hello!')
  * })
  * ```
  */
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(text, arg, setDefaultContentType(TEXT_PLAIN, headers));
  };
  /**
  * `.json()` can render JSON as `Content-Type:application/json`.
  *
  * @see {@link https://hono.dev/docs/api/context#json}
  *
  * @example
  * ```ts
  * app.get('/api', (c) => {
  *   return c.json({ message: 'Hello!' })
  * })
  * ```
  */
  json = (object, arg, headers) => {
    return this.#newResponse(JSON.stringify(object), arg, setDefaultContentType("application/json", headers));
  };
  html = (html, arg, headers) => {
    const res = (html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers));
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
  * `.redirect()` can Redirect, default status code is 302.
  *
  * @see {@link https://hono.dev/docs/api/context#redirect}
  *
  * @example
  * ```ts
  * app.get('/redirect', (c) => {
  *   return c.redirect('/')
  * })
  * app.get('/redirect-permanently', (c) => {
  *   return c.redirect('/', 301)
  * })
  * ```
  */
  redirect = (location, status) => {
    const locationString = String(location);
    this.header("Location", !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString));
    return this.newResponse(null, status ?? 302);
  };
  /**
  * `.notFound()` can return the Not Found Response.
  *
  * @see {@link https://hono.dev/docs/api/context#notfound}
  *
  * @example
  * ```ts
  * app.get('/notfound', (c) => {
  *   return c.notFound()
  * })
  * ```
  */
  notFound = () => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  };
};

// node_modules/hono/dist/compose.js
var compose = (middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) throw new Error("next() called multiple times");
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else handler = i === middleware.length && next || void 0;
      if (handler) try {
        res = await handler(context, () => dispatch(i + 1));
      } catch (err) {
        if (err instanceof Error && onError) {
          context.error = err;
          res = await onError(err, context);
          isError = true;
        } else throw err;
      }
      else if (context.finalized === false && onNotFound) res = await onNotFound(context);
      if (res && (context.finalized === false || isError)) context.res = res;
      return context;
    }
  };
};

// node_modules/hono/dist/router.js
var METHODS = [
  "get",
  "post",
  "put",
  "delete",
  "options",
  "patch",
  "query"
];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = (c) => {
  return c.text("404 Not Found", 404);
};
var errorHandler = (err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
};
var Hono = class Hono2 {
  get;
  post;
  put;
  delete;
  options;
  patch;
  query;
  all;
  on;
  use;
  router;
  getPath;
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    [...METHODS, "all"].forEach((method) => {
      this[method] = (args1, ...args) => {
        const methodName = method.toUpperCase();
        if (typeof args1 === "string") this.#path = args1;
        else this.#addRoute(methodName, this.#path, args1);
        args.forEach((handler) => {
          this.#addRoute(methodName, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          const methodName = m.toUpperCase();
          for (const handler of handlers) this.#addRoute(methodName, this.#path, handler);
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") this.#path = arg1;
      else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute("ALL", this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new Hono2({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  errorHandler = errorHandler;
  /**
  * `.route()` allows grouping other Hono instance in routes.
  *
  * @see {@link https://hono.dev/docs/api/routing#grouping}
  *
  * @param {string} path - base Path
  * @param {Hono} app - other Hono instance
  * @returns {Hono} routed Hono instance
  *
  * @example
  * ```ts
  * const app = new Hono()
  * const app2 = new Hono()
  *
  * app2.get("/user", (c) => c.text("user"))
  * app.route("/api", app2) // GET /api/user
  * ```
  */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) handler = r.handler;
      else {
        handler = async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res;
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  /**
  * `.basePath()` allows base paths to be specified.
  *
  * @see {@link https://hono.dev/docs/api/routing#base-path}
  *
  * @param {string} path - base Path
  * @returns {Hono} changed Hono instance
  *
  * @example
  * ```ts
  * const api = new Hono().basePath('/api')
  * ```
  */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
  * `.onError()` handles an error and returns a customized Response.
  *
  * @see {@link https://hono.dev/docs/api/hono#error-handling}
  *
  * @param {ErrorHandler} handler - request Handler for error
  * @returns {Hono} changed Hono instance
  *
  * @example
  * ```ts
  * app.onError((err, c) => {
  *   console.error(`${err}`)
  *   return c.text('Custom Error Message', 500)
  * })
  * ```
  */
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  /**
  * `.notFound()` allows you to customize a Not Found Response.
  *
  * @see {@link https://hono.dev/docs/api/hono#not-found}
  *
  * @param {NotFoundHandler} handler - request handler for not-found
  * @returns {Hono} changed Hono instance
  *
  * @example
  * ```ts
  * app.notFound((c) => {
  *   return c.text('Custom 404 Message', 404)
  * })
  * ```
  */
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  /**
  * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
  *
  * @deprecated Use `mount()` from `hono/mount` instead. `.mount()` will be removed in v5.
  *
  * @see {@link https://hono.dev/docs/api/hono#mount}
  *
  * @param {string} path - base Path
  * @param {Function} applicationHandler - other Request Handler
  * @param {MountOptions} [options] - options of `.mount()`
  * @returns {Hono} mounted Hono instance
  *
  * @example
  * ```ts
  * import { Router as IttyRouter } from 'itty-router'
  * import { Hono } from 'hono'
  * // Create itty-router application
  * const ittyRouter = IttyRouter()
  * // GET /itty-router/hello
  * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
  *
  * const app = new Hono()
  * app.mount('/itty-router', ittyRouter.handle)
  * ```
  *
  * @example
  * ```ts
  * const app = new Hono()
  * // Send the request to another application without modification.
  * app.mount('/app', anotherApp, {
  *   replaceRequest: (req) => req,
  * })
  * ```
  */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") optionHandler = options;
      else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) replaceRequest = (request) => request;
        else replaceRequest = options.replaceRequest;
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) return res;
      await next();
    };
    this.#addRoute("ALL", mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler, baseRoutePath) {
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler
    };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) return this.errorHandler(err, c);
    throw err;
  }
  #dispatch(request, executionCtx, env2, method) {
    if (method === "HEAD") return (async () => new Response(null, await this.#dispatch(request, executionCtx, env2, "GET")))();
    const path = this.getPath(request, { env: env2 });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env: env2,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then((resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
  * `.fetch()` will be entry point of your app.
  *
  * @see {@link https://hono.dev/docs/api/hono#fetch}
  *
  * @param {Request} request - request Object of request
  * @param {Env} env - env Object
  * @param {ExecutionContext} executionCtx - context of execution
  * @returns {Response | Promise<Response>} response of request
  *
  */
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  /**
  * `.request()` is a useful method for testing.
  * You can pass a URL or pathname to send a GET request.
  * app will return a Response object.
  * ```ts
  * test('GET /hello is ok', async () => {
  *   const res = await app.request('/hello')
  *   expect(res.status).toBe(200)
  * })
  * ```
  * @see https://hono.dev/docs/api/hono#request
  */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    input = input.toString();
    return this.fetch(new Request(/^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`, requestInit), Env, executionCtx);
  };
  /**
  * `.fire()` automatically adds a global fetch event listener.
  * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
  * @deprecated
  * Use `fire` from `hono/service-worker` instead.
  * ```ts
  * import { Hono } from 'hono'
  * import { fire } from 'hono/service-worker'
  *
  * const app = new Hono()
  * // ...
  * fire(app)
  * ```
  * @see https://hono.dev/docs/api/hono#fire
  * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
  * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
  */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
};

// node_modules/hono/dist/router/utils.js
var createNullObject = () => /* @__PURE__ */ Object.create(null);

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = ((method2, path2) => {
    const matcher = matchers[method2] || matchers["ALL"];
    const staticMatch = matcher[2][path2];
    if (staticMatch) return staticMatch;
    const match3 = path2.match(matcher[0]);
    if (!match3) return [[], emptyParam];
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  });
  this.match = match2;
  return match2(method, path);
}

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = Symbol();
var regExpMetaChars = /* @__PURE__ */ new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) return b.length === 1 ? a < b ? -1 : 1 : -1;
  if (b.length === 1) return 1;
  if (a === ".*" || a === "(?:|/.*)") return b === "(?:|/.*)" ? -1 : 1;
  else if (b === ".*" || b === "(?:|/.*)") return -1;
  if (a === "[^/]+") return 1;
  else if (b === "[^/]+") return -1;
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
var Node = class Node2 {
  #index;
  #varIndex;
  #children = createNullObject();
  insert(tokens, index, paramMap, context, isStatic) {
    let node = this;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const token = tokens[i];
      const pattern = token.length === 1 ? token === "*" ? i === len - 1 ? [
        "",
        "",
        ".*"
      ] : [
        "",
        "",
        LABEL_REG_EXP_STR
      ] : null : token === "/*" ? [
        "",
        "",
        TAIL_WILDCARD_REG_EXP_STR
      ] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
      let nextNode;
      if (pattern) {
        const name = pattern[1];
        let regexpStr = pattern[2] || "[^/]+";
        if (name && pattern[2]) {
          if (regexpStr === ".*") throw PATH_ERROR;
          regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
          if (/\((?!\?:)/.test(regexpStr)) throw PATH_ERROR;
          if (regexpStr.length === 1 && regExpMetaChars.has(regexpStr)) throw PATH_ERROR;
        }
        nextNode = node.#children[regexpStr];
        if (!nextNode) {
          if (regexpStr !== ".*" && regexpStr !== "(?:|/.*)") {
            for (const k in node.#children) if ((regexpStr.length > 1 || k.length > 1) && k !== ".*" && k !== "(?:|/.*)") throw PATH_ERROR;
          }
          nextNode = node.#children[regexpStr] = new Node2();
        }
        if (name !== "") {
          nextNode.#varIndex ??= context.varIndex++;
          paramMap.push([name, nextNode.#varIndex]);
        }
      } else {
        nextNode = node.#children[token];
        if (!nextNode) {
          for (const k in node.#children) if (k.length > 1 && k !== ".*" && k !== "(?:|/.*)") throw PATH_ERROR;
          nextNode = node.#children[token] = new Node2();
        }
      }
      node = nextNode;
    }
    if (node.#index !== void 0) throw PATH_ERROR;
    node.#index = isStatic ? -1 : index;
  }
  buildRegExpStr() {
    const strList2 = Object.keys(this.#children).sort(compareKey).map((k) => {
      const c = this.#children[k];
      const childStr = c.buildRegExpStr();
      return childStr === "" ? "" : (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + childStr;
    }).filter(Boolean);
    if (typeof this.#index === "number" && this.#index !== -1) strList2.unshift(`#${this.#index}`);
    if (strList2.length === 0) return "";
    if (strList2.length === 1) return strList2[0];
    return "(?:" + strList2.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  #context = { varIndex: 0 };
  #root = new Node();
  #index = 0;
  paths = createNullObject();
  insert(path, isStatic) {
    if (isStatic) {
      this.#root.insert(path.split(""), 0, [], this.#context, true);
      return;
    }
    const paramAssoc = [];
    const groups = [];
    let markedPath = path;
    for (let i = 0; ; ) {
      let replaced = false;
      markedPath = markedPath.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) break;
    }
    const tokens = markedPath.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j2 = tokens.length - 1; j2 >= 0; j2--) if (tokens[j2].indexOf(mark) !== -1) {
        tokens[j2] = tokens[j2].replace(mark, groups[i][1]);
        break;
      }
    }
    this.#root.insert(tokens, this.#index, paramAssoc, this.#context, false);
    this.paths[path] = [this.#index++, paramAssoc];
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") return [
      /^$/,
      [],
      []
    ];
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [
      new RegExp(`^${regexp}`),
      indexReplacementMap,
      paramReplacementMap
    ];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var wildcardRegExpCache = createNullObject();
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(`^${path.replace(/\/:[^/{}]+(?:\{\[\^\/]\+})?(?=[/{]|$)|\/?\*$|([.\\+*[^\]$()?{}|])/g, (match2, metaChar) => metaChar ? `\\${metaChar}` : match2 === "/*" ? TAIL_WILDCARD_REG_EXP_STR : match2 === "*" ? ".*" : `/:${LABEL_REG_EXP_STR}`)}$`);
}
function findMiddleware(middleware, path) {
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) if (buildWildcardRegExp(k).test(path)) return [...middleware[k]];
}
var RegExpRouter = class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  #tries;
  constructor() {
    this.#middleware = { ["ALL"]: createNullObject() };
    this.#routes = { ["ALL"]: createNullObject() };
    this.#tries = { ["ALL"]: new Trie() };
  }
  #insertPath(method, path) {
    try {
      this.#tries[method].insert(path, !/\*|\/:/.test(path));
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware) throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    if (!middleware[method]) {
      this.#tries[method] = new Trie();
      for (const handlerMap of [middleware, routes]) {
        handlerMap[method] = createNullObject();
        for (const p in handlerMap["ALL"]) {
          handlerMap[method][p] = [...handlerMap["ALL"][p]];
          this.#insertPath(method, p);
        }
      }
    }
    if (path === "/*") path = "*";
    const methods = method === "ALL" ? Object.keys(middleware) : [method];
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      for (const m of methods) if (!middleware[m][path]) {
        this.#insertPath(m, path);
        middleware[m][path] = findMiddleware(middleware[m], path) || findMiddleware(middleware["ALL"], path) || [];
      }
      for (const handlerMap of [middleware, routes]) for (const m of methods) for (const p in handlerMap[m]) re.test(p) && handlerMap[m][p].push([handler, path]);
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (const path2 of paths) for (const m of methods) {
      if (!routes[m][path2]) {
        this.#insertPath(m, path2);
        routes[m][path2] = findMiddleware(middleware[m], path2) || findMiddleware(middleware["ALL"], path2) || [];
      }
      routes[m][path2].push([handler, path2]);
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = createNullObject();
    for (const method of Object.keys(this.#routes)) matchers[method] = this.#buildMatcher(method);
    this.#middleware = this.#routes = this.#tries = void 0;
    wildcardRegExpCache = createNullObject();
    return matchers;
  }
  #buildMatcher(method) {
    const middleware = this.#middleware[method];
    const routes = this.#routes[method];
    const trie = this.#tries[method];
    const staticMap = createNullObject();
    const handlerData = [];
    const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
    for (const r of [middleware, routes]) for (const path in r) {
      const handlers = r[path];
      const pathData = trie.paths[path];
      if (!pathData) {
        staticMap[path] = [handlers.map(([h]) => [h, createNullObject()]), emptyParam];
        continue;
      }
      handlerData[pathData[0]] = handlers.map(([h, handlerPath]) => [h, trie.paths[handlerPath][1].reduceRight((map, [key2], i) => {
        map[key2] = paramReplacementMap[pathData[1][i][1]];
        return map;
      }, createNullObject())]);
    }
    return [
      regexp,
      indexReplacementMap.map((i) => handlerData[i]),
      staticMap
    ];
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    this.#routes.push([
      method,
      path,
      handler
    ]);
  }
  match(method, path) {
    if (!this.#routes) throw new Error("Fatal error");
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) router.add(...routes[i2]);
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) continue;
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) throw new Error("Fatal error");
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) throw new Error("No active router has been determined yet.");
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = createNullObject();
var order = 0;
var Node3 = class Node4 {
  #methods = [];
  #children = createNullObject();
  #patterns = [];
  #pattern;
  #params = emptyParams;
  insert(method, path, handler) {
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = /* @__PURE__ */ new Set();
    let i = 0;
    for (const p of parts) {
      const nextP = parts[++i];
      const pattern = getPattern(p, nextP) || (nextP === void 0 && p && p.indexOf("*") === p.length - 1 ? p : null);
      const isParam = Array.isArray(pattern);
      const key2 = isParam ? pattern[0] : pattern || p;
      const child = curNode.#children[key2] ||= new Node4();
      if (pattern && !child.#pattern) {
        child.#pattern = pattern;
        curNode.#patterns.push(child);
      }
      curNode = child;
      if (isParam) possibleKeys.add(pattern[1]);
    }
    curNode.#methods.push({ [method]: {
      handler,
      possibleKeys: [...possibleKeys],
      score: ++order
    } });
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m["ALL"];
      if (handlerSet) {
        handlerSet.params = createNullObject();
        handlerSets.push(handlerSet);
        for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
          const key2 = handlerSet.possibleKeys[i2];
          handlerSet.params[key2] = params?.[key2] && !i2 ? params[key2] : nodeParams[key2] ?? params?.[key2];
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    let curNodes = [this];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j2 = 0, len2 = curNodes.length; j2 < len2; j2++) {
        const node = curNodes[j2];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else tempNodes.push(nextNode);
        }
        for (const child of node.#patterns) {
          const pattern = child.#pattern;
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (typeof pattern === "string") {
            if (pattern === "*" || part.startsWith(pattern.slice(0, -1))) {
              this.#pushHandlerSets(handlerSets, child, method, node.#params);
              if (pattern === "*") {
                child.#params = params;
                tempNodes.push(child);
              }
            }
            continue;
          }
          const [, name, matcher] = pattern;
          if (!part && matcher === true) continue;
          if (matcher !== true) {
            if (!partOffsets) {
              partOffsets = [];
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.slice(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (m[0].length === restPathString.length && child.#children["*"]) this.#pushHandlerSets(handlerSets, child.#children["*"], method, node.#params, params);
              for (const _ in child.#children) {
                child.#params = params;
                const componentCount = m[0].match(/\//g)?.length ?? 0;
                (curNodesQueue[componentCount] ||= []).push(child);
                break;
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) this.#pushHandlerSets(handlerSets, child.#children["*"], method, params, node.#params);
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets[1]) handlerSets.sort((a, b) => {
      return a.score - b.score;
    });
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  name = "TrieRouter";
  #node = new Node3();
  add(method, path, handler) {
    for (const result of checkOptionalParameter(path) || [path]) this.#node.insert(method, result, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono3 = class extends Hono {
  /**
  * Creates an instance of the Hono class.
  *
  * @param options - Optional configuration options for the Hono instance.
  */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({ routers: [new RegExpRouter(), new TrieRouter()] });
  }
};

// node_modules/hono/dist/utils/cookie.js
var validCookieNameRegEx = /^[\w!#$%&'*.^`|~+-]+$/;
var relaxedCookieNameRegEx = /^[!#-:<>-[\]-~]+$/;
var validCookieValueRegEx = /^[ !#-:<-[\]-~]*$/;
var trimCookieWhitespace = (value) => {
  let start = 0;
  let end = value.length;
  while (start < end) {
    const charCode = value.charCodeAt(start);
    if (charCode !== 32 && charCode !== 9) break;
    start++;
  }
  while (end > start) {
    const charCode = value.charCodeAt(end - 1);
    if (charCode !== 32 && charCode !== 9) break;
    end--;
  }
  return start === 0 && end === value.length ? value : value.slice(start, end);
};
var parse = (cookie, name) => {
  if (name && cookie.indexOf(name) === -1) return {};
  const pairs = cookie.split(";");
  const parsedCookie = /* @__PURE__ */ Object.create(null);
  for (const pairStr of pairs) {
    const valueStartPos = pairStr.indexOf("=");
    if (valueStartPos === -1) continue;
    const cookieName = trimCookieWhitespace(pairStr.substring(0, valueStartPos));
    if (name && name !== cookieName || !relaxedCookieNameRegEx.test(cookieName) || cookieName in parsedCookie) continue;
    let cookieValue = trimCookieWhitespace(pairStr.substring(valueStartPos + 1));
    if (cookieValue.startsWith('"') && cookieValue.endsWith('"')) cookieValue = cookieValue.slice(1, -1);
    if (validCookieValueRegEx.test(cookieValue)) {
      parsedCookie[cookieName] = tryDecodeURIComponent(cookieValue);
      if (name) break;
    }
  }
  return parsedCookie;
};
var _serialize = (name, value, opt = {}) => {
  if (!validCookieNameRegEx.test(name)) throw new Error("Invalid cookie name");
  let cookie = `${name}=${value}`;
  if (name.startsWith("__Secure-") && !opt.secure) throw new Error("__Secure- Cookie must have Secure attributes");
  if (name.startsWith("__Host-")) {
    if (!opt.secure) throw new Error("__Host- Cookie must have Secure attributes");
    if (opt.path !== "/") throw new Error('__Host- Cookie must have Path attributes with "/"');
    if (opt.domain) throw new Error("__Host- Cookie must not have Domain attributes");
  }
  for (const key2 of [
    "domain",
    "path",
    "sameSite",
    "priority"
  ]) if (opt[key2] && /[;\r\n]/.test(opt[key2])) throw new Error(`${key2} must not contain ";", "\\r", or "\\n"`);
  if (opt && typeof opt.maxAge === "number" && opt.maxAge >= 0) {
    if (opt.maxAge > 3456e4) throw new Error("Cookies Max-Age SHOULD NOT be greater than 400 days (34560000 seconds) in duration.");
    cookie += `; Max-Age=${opt.maxAge | 0}`;
  }
  if (opt.domain && opt.prefix !== "host") cookie += `; Domain=${opt.domain}`;
  if (opt.path) cookie += `; Path=${opt.path}`;
  if (opt.expires) {
    if (opt.expires.getTime() - Date.now() > 3456e7) throw new Error("Cookies Expires SHOULD NOT be greater than 400 days (34560000 seconds) in the future.");
    cookie += `; Expires=${opt.expires.toUTCString()}`;
  }
  if (opt.httpOnly) cookie += "; HttpOnly";
  if (opt.secure) cookie += "; Secure";
  if (opt.sameSite) cookie += `; SameSite=${opt.sameSite.charAt(0).toUpperCase() + opt.sameSite.slice(1)}`;
  if (opt.priority) cookie += `; Priority=${opt.priority.charAt(0).toUpperCase() + opt.priority.slice(1)}`;
  if (opt.partitioned) {
    if (!opt.secure) throw new Error("Partitioned Cookie must have Secure attributes");
    cookie += "; Partitioned";
  }
  return cookie;
};
var serialize = (name, value, opt) => {
  value = encodeURIComponent(value);
  return _serialize(name, value, opt);
};

// node_modules/hono/dist/helper/cookie/index.js
var getCookie = (c, key2, prefix) => {
  const cookie = c.req.raw.headers.get("Cookie");
  if (typeof key2 === "string") {
    if (!cookie) return;
    let finalKey = key2;
    if (prefix === "secure") finalKey = "__Secure-" + key2;
    else if (prefix === "host") finalKey = "__Host-" + key2;
    return parse(cookie, finalKey)[finalKey];
  }
  if (!cookie) return {};
  return parse(cookie);
};
var generateCookie = (name, value, opt) => {
  let cookie;
  if (opt?.prefix === "secure") cookie = serialize("__Secure-" + name, value, {
    path: "/",
    ...opt,
    secure: true
  });
  else if (opt?.prefix === "host") cookie = serialize("__Host-" + name, value, {
    ...opt,
    path: "/",
    secure: true,
    domain: void 0
  });
  else cookie = serialize(name, value, {
    path: "/",
    ...opt
  });
  return cookie;
};
var setCookie = (c, name, value, opt) => {
  const cookie = generateCookie(name, value, opt);
  c.header("Set-Cookie", cookie, { append: true });
};
var deleteCookie = (c, name, opt) => {
  const deletedCookie = getCookie(c, name, opt?.prefix);
  setCookie(c, name, "", {
    ...opt,
    maxAge: 0
  });
  return deletedCookie;
};

// worker/lib/crypto.ts
var enc = new TextEncoder();
function randomId(prefix = "") {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const s = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 16);
  return prefix ? `${prefix}_${s}` : s;
}
function randomToken(bytes = 32) {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function sha256Hex(input) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
var PBKDF2_ITER = 12e4;
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key2 = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITER }, key2, 256);
  return `pbkdf2$${PBKDF2_ITER}$${toB64(salt)}$${toB64(new Uint8Array(bits))}`;
}
async function verifyPassword(password, stored) {
  const [scheme, iterStr, saltB64, hashB64] = stored.split("$");
  if (scheme !== "pbkdf2") return false;
  const salt = fromB64(saltB64);
  const key2 = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: Number(iterStr) }, key2, 256)
  );
  const expected = fromB64(hashB64);
  if (expected.length !== bits.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i];
  return diff === 0;
}
function toB64(u8) {
  return btoa(String.fromCharCode(...u8));
}
function fromB64(s) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
function randomDigits(n) {
  const arr = crypto.getRandomValues(new Uint32Array(n));
  return Array.from(arr, (x) => String(x % 10)).join("");
}

// worker/lib/db.ts
var now = () => (/* @__PURE__ */ new Date()).toISOString();
var j = (s, fallback) => {
  if (typeof s !== "string") return fallback;
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
};
var l10n = (s) => {
  const v = j(s, {});
  return { en: v.en ?? "", ar: v.ar ?? "" };
};
var DEFAULT_SETTINGS = {
  theme: "midnight",
  defaultLang: "ar",
  showNutrition: true,
  showCoreComponents: true,
  title: { en: "Artisan Kitchen", ar: "\u0627\u0644\u0645\u0637\u0628\u062E \u0627\u0644\u062D\u0631\u0641\u064A" },
  subtitle: { en: "Selection", ar: "\u0627\u0644\u062A\u0634\u0643\u064A\u0644\u0629" },
  tagline: { en: "", ar: "" },
  philosophyTitle: { en: "", ar: "" },
  philosophyBody: { en: "", ar: "" },
  logoImage: null,
  openAccess: false
};
function rowToClient(r) {
  return { id: r.id, name: r.name, slug: r.slug, status: r.status, createdAt: r.created_at };
}
function rowToMenu(r) {
  const s = j(r.settings, {});
  return {
    id: r.id,
    clientId: r.client_id,
    name: r.name,
    slug: r.slug,
    status: r.status,
    settings: { ...DEFAULT_SETTINGS, ...s, title: { ...DEFAULT_SETTINGS.title, ...s.title || {} } },
    contentUpdatedAt: r.content_updated_at ?? null,
    createdAt: r.created_at
  };
}
function rowToCategory(r) {
  return {
    id: r.id,
    menuId: r.menu_id,
    name: l10n(r.name),
    description: l10n(r.description),
    image: r.image ?? null,
    isHidden: !!r.is_hidden,
    sortOrder: r.sort_order ?? 0,
    disclaimerEnabled: !!r.disclaimer_enabled,
    disclaimerImage: r.disclaimer_image ?? null,
    disclaimerText: l10n(r.disclaimer_text)
  };
}
function rowToDish(r) {
  return {
    id: r.id,
    menuId: r.menu_id,
    categoryId: r.category_id,
    name: l10n(r.name),
    description: l10n(r.description),
    extraInfo: l10n(r.extra_info),
    image: r.image ?? null,
    angleImages: j(r.angle_images, []),
    ingredients: j(r.ingredients, []).map((x) => typeof x === "string" ? { en: x, ar: "" } : { en: x.en ?? "", ar: x.ar ?? "" }),
    sideDishes: j(r.side_dishes, []).map((x) => typeof x === "string" ? { en: x, ar: "" } : { en: x.en ?? "", ar: x.ar ?? "" }),
    nutrition: { calories: 0, protein: 0, fat: 0, carbohydrates: 0, fiber: 0, ...j(r.nutrition, {}) },
    suitableFor: j(r.suitable_for, []),
    coreComponents: j(r.core_components, []),
    tags: j(r.tags, []),
    recommendedDishIds: j(r.recommended_dish_ids, []),
    isHidden: !!r.is_hidden,
    isFeatured: !!r.is_featured,
    sortOrder: r.sort_order ?? 0,
    updatedAt: r.updated_at
  };
}
function rowToUser(r, menuIds = []) {
  return {
    id: r.id,
    email: r.email,
    firstName: r.first_name,
    lastName: r.last_name,
    role: r.role,
    status: r.status,
    menuIds,
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at ?? null
  };
}
function rowToDevice(r) {
  return {
    id: r.id,
    menuId: r.menu_id,
    name: r.name,
    building: r.building,
    location: r.location,
    status: r.status,
    tokenPreview: r.token_preview,
    createdAt: r.created_at,
    lastSeenAt: r.last_seen_at ?? null
  };
}
function rowToOrder(r, includeInternal) {
  return {
    id: r.id,
    menuId: r.menu_id,
    number: r.number,
    status: r.status,
    customerName: r.customer_name,
    customerContact: includeInternal ? r.customer_contact : "",
    deliveryAt: r.delivery_at ?? null,
    specialInstructions: r.special_instructions,
    internalNotes: includeInternal ? r.internal_notes : "",
    items: j(r.items, []),
    createdBy: r.created_by ?? "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    events: j(r.events, [])
  };
}
async function touchMenu(db, menuId) {
  await db.prepare("UPDATE menus SET content_updated_at = ? WHERE id = ?").bind(now(), menuId).run();
}
async function audit(db, userId, action, entity, entityId, detail) {
  await db.prepare("INSERT INTO audit_log (user_id, action, entity, entity_id, detail) VALUES (?,?,?,?,?)").bind(userId, action, entity ?? null, entityId ?? null, detail ? JSON.stringify(detail) : null).run();
}

// worker/lib/auth.ts
var COOKIE = "ak_session";
var SESSION_DAYS = 30;
async function createSession(c, userId) {
  const token = randomToken(32);
  const id = await sha256Hex(token);
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await c.env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at, user_agent) VALUES (?,?,?,?)").bind(id, userId, expires.toISOString(), c.req.header("user-agent") ?? null).run();
  await c.env.DB.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").bind(now(), userId).run();
  const secure = new URL(c.req.url).protocol === "https:";
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure,
    path: "/",
    expires
  });
}
async function destroySession(c) {
  const token = getCookie(c, COOKIE);
  if (token) {
    const id = await sha256Hex(token);
    await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
  }
  deleteCookie(c, COOKIE, { path: "/" });
}
var sessionLoader = async (c, next) => {
  c.set("user", null);
  c.set("sessionId", null);
  const token = getCookie(c, COOKIE);
  if (token) {
    const id = await sha256Hex(token);
    const row = await c.env.DB.prepare(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`
    ).bind(id).first();
    if (row && row.status === "active" && new Date(row.expires_at) > /* @__PURE__ */ new Date()) {
      const menus = await c.env.DB.prepare("SELECT menu_id FROM staff_assignments WHERE user_id = ?").bind(row.id).all();
      const user = {
        id: row.id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        role: row.role,
        menuIds: menus.results.map((m) => m.menu_id)
      };
      c.set("user", user);
      c.set("sessionId", id);
    }
  }
  await next();
};
function requireRole(...roles) {
  return async (c, next) => {
    const u = c.get("user");
    if (!u) throw new HTTPException(401, { message: "Sign in required" });
    if (u.role !== "admin" && !roles.includes(u.role)) throw new HTTPException(403, { message: "Not allowed for your role" });
    await next();
  };
}
function canAccessMenu(u, menuId) {
  return u.role === "admin" || u.menuIds.includes(menuId);
}
function assertMenuAccess(c, menuId) {
  const u = c.get("user");
  if (!u) throw new HTTPException(401, { message: "Sign in required" });
  if (!canAccessMenu(u, menuId)) throw new HTTPException(403, { message: "You are not assigned to this menu" });
  return u;
}
var displayName = (u) => `${u.firstName} ${u.lastName}`.trim() || u.email;

// shared/types.ts
var STAFF_ROLES = ["admin", "sub-admin", "butler", "chef"];
var THEMES = [
  { id: "midnight", label: { en: "Midnight", ar: "\u0644\u064A\u0644\u064A" } },
  { id: "ivory", label: { en: "Ivory", ar: "\u0639\u0627\u062C\u064A" } },
  { id: "olive", label: { en: "Olive", ar: "\u0632\u064A\u062A\u0648\u0646\u064A" } },
  { id: "blush", label: { en: "Blush", ar: "\u0648\u0631\u062F\u064A" } }
];
var SUITABLE_FOR = [
  { id: "breakfast", label: { en: "Breakfast", ar: "\u0641\u0637\u0648\u0631" } },
  { id: "lunch", label: { en: "Lunch", ar: "\u063A\u062F\u0627\u0621" } },
  { id: "dinner", label: { en: "Dinner", ar: "\u0639\u0634\u0627\u0621" } },
  { id: "pre-workout", label: { en: "Pre-workout", ar: "\u0642\u0628\u0644 \u0627\u0644\u062A\u0645\u0631\u064A\u0646" } },
  { id: "post-workout", label: { en: "Post-workout", ar: "\u0628\u0639\u062F \u0627\u0644\u062A\u0645\u0631\u064A\u0646" } },
  { id: "light-meal", label: { en: "Light meal", ar: "\u0648\u062C\u0628\u0629 \u062E\u0641\u064A\u0641\u0629" } },
  { id: "high-protein", label: { en: "High protein", ar: "\u0639\u0627\u0644\u064A \u0627\u0644\u0628\u0631\u0648\u062A\u064A\u0646" } },
  { id: "low-carb", label: { en: "Low carb", ar: "\u0642\u0644\u064A\u0644 \u0627\u0644\u0643\u0627\u0631\u0628" } }
];
var CORE_COMPONENTS = [
  { id: "nuts", label: { en: "Nuts", ar: "\u0645\u0643\u0633\u0631\u0627\u062A" } },
  { id: "fish", label: { en: "Fish", ar: "\u0633\u0645\u0643" } },
  { id: "olive-oil", label: { en: "Olive oil", ar: "\u0632\u064A\u062A \u0632\u064A\u062A\u0648\u0646" } },
  { id: "dairy", label: { en: "Dairy", ar: "\u0623\u0644\u0628\u0627\u0646" } },
  { id: "vegetables", label: { en: "Vegetables", ar: "\u062E\u0636\u0627\u0631" } },
  { id: "fruit", label: { en: "Fruit", ar: "\u0641\u0648\u0627\u0643\u0647" } },
  { id: "legumes", label: { en: "Legumes", ar: "\u0628\u0642\u0648\u0644\u064A\u0627\u062A" } },
  { id: "whole-grains", label: { en: "Whole grains", ar: "\u062D\u0628\u0648\u0628 \u0643\u0627\u0645\u0644\u0629" } }
];
var TRANSITIONS = {
  draft: [{ to: "submitted", roles: ["butler", "admin"] }, { to: "cancelled", roles: ["butler", "admin"] }],
  submitted: [
    { to: "preparing", roles: ["chef", "admin"] },
    { to: "rejected", roles: ["chef", "admin"] },
    { to: "cancelled", roles: ["butler", "admin"] }
  ],
  preparing: [{ to: "ready", roles: ["chef", "admin"] }],
  ready: [{ to: "out_for_delivery", roles: ["butler", "admin"] }],
  out_for_delivery: [{ to: "delivered", roles: ["butler", "admin"] }],
  delivered: [{ to: "completed", roles: ["butler", "admin"] }],
  completed: [],
  cancelled: [],
  rejected: []
};

// worker/lib/validate.ts
function bad(msg) {
  throw new HTTPException(400, { message: msg });
}
var str = (v, field, { max = 2e3, required = false } = {}) => {
  if (v === void 0 || v === null) {
    if (required) bad(`${field} is required`);
    return "";
  }
  if (typeof v !== "string") bad(`${field} must be text`);
  const s = v.trim();
  if (required && !s) bad(`${field} is required`);
  if (s.length > max) bad(`${field} is too long`);
  return s;
};
var num = (v, field, fallback = 0) => {
  if (v === void 0 || v === null || v === "") return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) bad(`${field} must be a number`);
  return n;
};
var bool = (v, fallback = false) => v === void 0 || v === null ? fallback : !!v;
var l10n2 = (v, field, max = 4e3) => {
  if (v === void 0 || v === null) return { en: "", ar: "" };
  if (typeof v === "string") return { en: v.trim().slice(0, max), ar: "" };
  if (typeof v !== "object") bad(`${field} must be {en, ar}`);
  const o = v;
  return { en: str(o.en, `${field}.en`, { max }), ar: str(o.ar, `${field}.ar`, { max }) };
};
var l10nList = (v, field) => {
  if (v === void 0 || v === null) return [];
  if (!Array.isArray(v)) bad(`${field} must be a list`);
  return v.map((x, i) => l10n2(x, `${field}[${i}]`, 300)).filter((x) => x.en || x.ar);
};
var strList = (v, field, allowed) => {
  if (v === void 0 || v === null) return [];
  if (!Array.isArray(v)) bad(`${field} must be a list`);
  const out = v.map((x) => String(x));
  if (allowed) {
    for (const x of out) if (!allowed.includes(x)) bad(`${field} contains unknown value "${x}"`);
  }
  return out;
};
var slug = (v, field) => {
  const s = str(v, field, { max: 60, required: true }).toLowerCase().replace(/[^a-z0-9؀-ۿ-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!s) bad(`${field} is not a valid slug`);
  return s;
};
var email = (v) => {
  const s = str(v, "email", { max: 200, required: true }).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) bad("email is not valid");
  return s;
};
var imageRef = (v) => {
  if (v === void 0 || v === null || v === "") return null;
  const s = String(v);
  if (/^(img_[a-z0-9]+|\/img\/img_[a-z0-9]+|https?:\/\/[^\s]+|data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+)$/.test(s)) return s.replace(/^\/img\//, "");
  bad("image reference is not valid");
};

// worker/routes/admin.ts
var admin = new Hono3();
admin.get("/clients", requireRole("admin"), async (c) => {
  const rows = await c.env.DB.prepare("SELECT * FROM clients ORDER BY created_at").all();
  return c.json({ clients: rows.results.map(rowToClient) });
});
admin.post("/clients", requireRole("admin"), async (c) => {
  const b = await c.req.json();
  const id = randomId("cl");
  const name = str(b.name, "name", { max: 120, required: true });
  const sl = slug(b.slug ?? name, "slug");
  try {
    await c.env.DB.prepare("INSERT INTO clients (id, name, slug) VALUES (?,?,?)").bind(id, name, sl).run();
  } catch {
    throw new HTTPException(409, { message: "A client with this slug already exists" });
  }
  await audit(c.env.DB, c.get("user").id, "client.create", "client", id);
  const row = await c.env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(id).first();
  return c.json({ client: rowToClient(row) }, 201);
});
admin.patch("/clients/:id", requireRole("admin"), async (c) => {
  const b = await c.req.json();
  const id = c.req.param("id");
  const cur = await c.env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(id).first();
  if (!cur) throw new HTTPException(404, { message: "Client not found" });
  const name = b.name !== void 0 ? str(b.name, "name", { max: 120, required: true }) : cur.name;
  const sl = b.slug !== void 0 ? slug(b.slug, "slug") : cur.slug;
  const status = b.status === "inactive" ? "inactive" : b.status === "active" ? "active" : cur.status;
  await c.env.DB.prepare("UPDATE clients SET name=?, slug=?, status=? WHERE id=?").bind(name, sl, status, id).run();
  const row = await c.env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(id).first();
  return c.json({ client: rowToClient(row) });
});
admin.delete("/clients/:id", requireRole("admin"), async (c) => {
  await c.env.DB.prepare("DELETE FROM clients WHERE id = ?").bind(c.req.param("id")).run();
  await audit(c.env.DB, c.get("user").id, "client.delete", "client", c.req.param("id"));
  return c.json({ ok: true });
});
admin.get("/menus", requireRole(...STAFF_ROLES), async (c) => {
  const u = c.get("user");
  const rows = await c.env.DB.prepare("SELECT * FROM menus ORDER BY created_at").all();
  const menus = rows.results.map(rowToMenu).filter((m) => u.role === "admin" || u.menuIds.includes(m.id));
  return c.json({ menus });
});
admin.post("/menus", requireRole("admin"), async (c) => {
  const b = await c.req.json();
  const clientId = str(b.clientId, "clientId", { required: true });
  const client = await c.env.DB.prepare("SELECT id FROM clients WHERE id = ?").bind(clientId).first();
  if (!client) throw new HTTPException(404, { message: "Client not found" });
  const name = str(b.name, "name", { max: 120, required: true });
  const sl = slug(b.slug ?? name, "slug");
  const id = randomId("mn");
  const settings = { ...DEFAULT_SETTINGS, title: { en: name, ar: name } };
  try {
    await c.env.DB.prepare("INSERT INTO menus (id, client_id, name, slug, settings, content_updated_at) VALUES (?,?,?,?,?,?)").bind(id, clientId, name, sl, JSON.stringify(settings), now()).run();
  } catch {
    throw new HTTPException(409, { message: "A menu with this slug already exists" });
  }
  await audit(c.env.DB, c.get("user").id, "menu.create", "menu", id);
  const row = await c.env.DB.prepare("SELECT * FROM menus WHERE id = ?").bind(id).first();
  return c.json({ menu: rowToMenu(row) }, 201);
});
admin.patch("/menus/:id", requireRole("admin", "sub-admin"), async (c) => {
  const id = c.req.param("id");
  const u = assertMenuAccess(c, id);
  const b = await c.req.json();
  const cur = await c.env.DB.prepare("SELECT * FROM menus WHERE id = ?").bind(id).first();
  if (!cur) throw new HTTPException(404, { message: "Menu not found" });
  const menu = rowToMenu(cur);
  let name = menu.name, sl = menu.slug, status = menu.status;
  if (u.role === "admin") {
    if (b.name !== void 0) name = str(b.name, "name", { max: 120, required: true });
    if (b.slug !== void 0) sl = slug(b.slug, "slug");
    if (b.status === "active" || b.status === "inactive") status = b.status;
  }
  let settings = menu.settings;
  if (b.settings && typeof b.settings === "object") {
    const s = b.settings;
    settings = {
      ...settings,
      theme: THEMES.some((t) => t.id === s.theme) ? s.theme : settings.theme,
      defaultLang: s.defaultLang === "en" || s.defaultLang === "ar" ? s.defaultLang : settings.defaultLang,
      showNutrition: bool(s.showNutrition, settings.showNutrition),
      showCoreComponents: bool(s.showCoreComponents, settings.showCoreComponents),
      title: s.title !== void 0 ? l10n2(s.title, "title", 120) : settings.title,
      subtitle: s.subtitle !== void 0 ? l10n2(s.subtitle, "subtitle", 120) : settings.subtitle,
      tagline: s.tagline !== void 0 ? l10n2(s.tagline, "tagline", 400) : settings.tagline,
      philosophyTitle: s.philosophyTitle !== void 0 ? l10n2(s.philosophyTitle, "philosophyTitle", 120) : settings.philosophyTitle,
      philosophyBody: s.philosophyBody !== void 0 ? l10n2(s.philosophyBody, "philosophyBody", 2e3) : settings.philosophyBody,
      logoImage: s.logoImage !== void 0 ? imageRef(s.logoImage) : settings.logoImage,
      openAccess: u.role === "admin" ? bool(s.openAccess, settings.openAccess) : settings.openAccess
    };
  }
  try {
    await c.env.DB.prepare("UPDATE menus SET name=?, slug=?, status=?, settings=? WHERE id=?").bind(name, sl, status, JSON.stringify(settings), id).run();
  } catch {
    throw new HTTPException(409, { message: "A menu with this slug already exists" });
  }
  await touchMenu(c.env.DB, id);
  await audit(c.env.DB, u.id, "menu.update", "menu", id);
  const row = await c.env.DB.prepare("SELECT * FROM menus WHERE id = ?").bind(id).first();
  return c.json({ menu: rowToMenu(row) });
});
admin.delete("/menus/:id", requireRole("admin"), async (c) => {
  await c.env.DB.prepare("DELETE FROM menus WHERE id = ?").bind(c.req.param("id")).run();
  await audit(c.env.DB, c.get("user").id, "menu.delete", "menu", c.req.param("id"));
  return c.json({ ok: true });
});
async function loadUsers(db) {
  const rows = await db.prepare("SELECT * FROM users ORDER BY created_at").all();
  const asg = await db.prepare("SELECT user_id, menu_id FROM staff_assignments").all();
  const byUser = /* @__PURE__ */ new Map();
  for (const a of asg.results) byUser.set(a.user_id, [...byUser.get(a.user_id) ?? [], a.menu_id]);
  return rows.results.map((r) => rowToUser(r, byUser.get(r.id) ?? []));
}
admin.get("/users", requireRole("admin"), async (c) => c.json({ users: await loadUsers(c.env.DB) }));
var ROLES = ["admin", "sub-admin", "butler", "chef", "pending"];
admin.post("/users", requireRole("admin"), async (c) => {
  const b = await c.req.json();
  const em = email(b.email);
  const pw = str(b.password, "password", { required: true, max: 200 });
  if (pw.length < 8) throw new HTTPException(400, { message: "Password must be at least 8 characters" });
  const role = ROLES.includes(b.role) ? b.role : "pending";
  const id = randomId("us");
  try {
    await c.env.DB.prepare("INSERT INTO users (id, email, password_hash, first_name, last_name, role) VALUES (?,?,?,?,?,?)").bind(id, em, await hashPassword(pw), str(b.firstName, "firstName", { max: 80 }), str(b.lastName, "lastName", { max: 80 }), role).run();
  } catch {
    throw new HTTPException(409, { message: "A user with this email already exists" });
  }
  const menuIds = strList(b.menuIds, "menuIds");
  if (menuIds.length) {
    await c.env.DB.batch(menuIds.map((m) => c.env.DB.prepare("INSERT OR IGNORE INTO staff_assignments (user_id, menu_id) VALUES (?,?)").bind(id, m)));
  }
  await audit(c.env.DB, c.get("user").id, "user.create", "user", id, { role });
  const users = await loadUsers(c.env.DB);
  return c.json({ user: users.find((u) => u.id === id) }, 201);
});
admin.patch("/users/:id", requireRole("admin"), async (c) => {
  const id = c.req.param("id");
  const me = c.get("user");
  const b = await c.req.json();
  const cur = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
  if (!cur) throw new HTTPException(404, { message: "User not found" });
  const role = b.role !== void 0 && ROLES.includes(b.role) ? b.role : cur.role;
  const status = b.status === "disabled" ? "disabled" : b.status === "active" ? "active" : cur.status;
  if (id === me.id && (role !== "admin" || status !== "active")) throw new HTTPException(400, { message: "You cannot demote or disable your own account" });
  const stmts = [
    c.env.DB.prepare("UPDATE users SET first_name=?, last_name=?, role=?, status=? WHERE id=?").bind(
      b.firstName !== void 0 ? str(b.firstName, "firstName", { max: 80 }) : cur.first_name,
      b.lastName !== void 0 ? str(b.lastName, "lastName", { max: 80 }) : cur.last_name,
      role,
      status,
      id
    )
  ];
  if (b.password) {
    const pw = str(b.password, "password", { max: 200 });
    if (pw.length < 8) throw new HTTPException(400, { message: "Password must be at least 8 characters" });
    stmts.push(c.env.DB.prepare("UPDATE users SET password_hash=? WHERE id=?").bind(await hashPassword(pw), id));
    stmts.push(c.env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(id));
  }
  if (Array.isArray(b.menuIds)) {
    stmts.push(c.env.DB.prepare("DELETE FROM staff_assignments WHERE user_id=?").bind(id));
    for (const m of strList(b.menuIds, "menuIds")) stmts.push(c.env.DB.prepare("INSERT OR IGNORE INTO staff_assignments (user_id, menu_id) VALUES (?,?)").bind(id, m));
  }
  if (status === "disabled") stmts.push(c.env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(id));
  await c.env.DB.batch(stmts);
  await audit(c.env.DB, me.id, "user.update", "user", id, { role, status });
  const users = await loadUsers(c.env.DB);
  return c.json({ user: users.find((u) => u.id === id) });
});
admin.delete("/users/:id", requireRole("admin"), async (c) => {
  const id = c.req.param("id");
  if (id === c.get("user").id) throw new HTTPException(400, { message: "You cannot delete your own account" });
  await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
  await audit(c.env.DB, c.get("user").id, "user.delete", "user", id);
  return c.json({ ok: true });
});
admin.get("/menus/:menuId/devices", requireRole("admin"), async (c) => {
  const menuId = c.req.param("menuId");
  const rows = await c.env.DB.prepare("SELECT * FROM devices WHERE menu_id = ? ORDER BY created_at DESC").bind(menuId).all();
  return c.json({ devices: rows.results.map(rowToDevice) });
});
admin.post("/menus/:menuId/devices", requireRole("admin"), async (c) => {
  const menuId = c.req.param("menuId");
  const b = await c.req.json();
  const token = b.token ? str(b.token, "token", { max: 64, required: true }) : randomDigits(8);
  if (token.length < 4) throw new HTTPException(400, { message: "Token must be at least 4 characters" });
  const id = randomId("dv");
  await c.env.DB.prepare("INSERT INTO devices (id, menu_id, name, building, location, token_hash, token_preview) VALUES (?,?,?,?,?,?,?)").bind(id, menuId, str(b.name, "name", { max: 80 }), str(b.building, "building", { max: 80 }), str(b.location, "location", { max: 80 }), await sha256Hex(token), token.slice(-4)).run();
  await audit(c.env.DB, c.get("user").id, "device.create", "device", id);
  const row = await c.env.DB.prepare("SELECT * FROM devices WHERE id = ?").bind(id).first();
  return c.json({ device: rowToDevice(row), token }, 201);
});
admin.patch("/devices/:id", requireRole("admin"), async (c) => {
  const id = c.req.param("id");
  const b = await c.req.json();
  const cur = await c.env.DB.prepare("SELECT * FROM devices WHERE id = ?").bind(id).first();
  if (!cur) throw new HTTPException(404, { message: "Device not found" });
  let token;
  let tokenHash = cur.token_hash, preview = cur.token_preview;
  if (b.rotateToken || b.token) {
    token = b.token ? str(b.token, "token", { max: 64, required: true }) : randomDigits(8);
    tokenHash = await sha256Hex(token);
    preview = token.slice(-4);
  }
  const status = b.status === "revoked" ? "revoked" : b.status === "active" ? "active" : cur.status;
  await c.env.DB.prepare("UPDATE devices SET name=?, building=?, location=?, status=?, token_hash=?, token_preview=? WHERE id=?").bind(
    b.name !== void 0 ? str(b.name, "name", { max: 80 }) : cur.name,
    b.building !== void 0 ? str(b.building, "building", { max: 80 }) : cur.building,
    b.location !== void 0 ? str(b.location, "location", { max: 80 }) : cur.location,
    status,
    tokenHash,
    preview,
    id
  ).run();
  await audit(c.env.DB, c.get("user").id, "device.update", "device", id, { status, rotated: !!token });
  const row = await c.env.DB.prepare("SELECT * FROM devices WHERE id = ?").bind(id).first();
  return c.json({ device: rowToDevice(row), token });
});
admin.delete("/devices/:id", requireRole("admin"), async (c) => {
  await c.env.DB.prepare("DELETE FROM devices WHERE id = ?").bind(c.req.param("id")).run();
  return c.json({ ok: true });
});
admin.get("/audit", requireRole("admin"), async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT a.*, u.email FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 200`
  ).all();
  return c.json({ entries: rows.results });
});

// worker/lib/imageStore.ts
async function putImage(kv, id, bytes, contentType) {
  await kv.put(id, bytes, { metadata: { contentType } });
}
async function getImage(kv, id) {
  const { value, metadata } = await kv.getWithMetadata(id, { type: "arrayBuffer", cacheTtl: 86400 });
  if (!value) return null;
  return { bytes: value, contentType: metadata?.contentType ?? "image/jpeg" };
}
async function deleteImage(kv, id) {
  await kv.delete(id);
}

// worker/routes/ai.ts
var ai = new Hono3();
ai.use("*", requireRole("admin", "sub-admin"));
var TEXT_MODEL = "gemini-2.5-flash";
var IMAGE_MODEL = "gemini-2.5-flash-image";
ai.get("/status", (c) => c.json({ enabled: !!c.env.GEMINI_API_KEY }));
function key(c) {
  if (!c.env.GEMINI_API_KEY) throw new HTTPException(503, { message: "AI tools are not configured (GEMINI_API_KEY missing)" });
  return c.env.GEMINI_API_KEY;
}
async function gemini(apiKey, model, body) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const t = await res.text();
    throw new HTTPException(502, { message: `Gemini error ${res.status}: ${t.slice(0, 300)}` });
  }
  return res.json();
}
async function loadImagePart(c, ref) {
  if (ref.startsWith("data:")) {
    const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(ref);
    if (!m) throw new HTTPException(400, { message: "Bad data URL" });
    return { inline_data: { mime_type: m[1], data: m[2] } };
  }
  const id = ref.replace(/^\/img\//, "");
  const obj = await getImage(c.env.IMAGES, id);
  if (!obj) throw new HTTPException(404, { message: "Image not found" });
  const buf = new Uint8Array(obj.bytes);
  let bin = "";
  for (let i = 0; i < buf.length; i += 32768) bin += String.fromCharCode(...buf.subarray(i, i + 32768));
  return { inline_data: { mime_type: obj.contentType, data: btoa(bin) } };
}
async function saveGeneratedImage(c, part, menuId) {
  const data = part.inlineData?.data ?? part.inline_data?.data;
  const mime = part.inlineData?.mimeType ?? part.inline_data?.mime_type ?? "image/png";
  const bytes = Uint8Array.from(atob(data), (ch) => ch.charCodeAt(0));
  const id = randomId("img");
  await putImage(c.env.IMAGES, id, bytes, mime);
  await c.env.DB.prepare("INSERT INTO images (id, menu_id, content_type, bytes, created_by) VALUES (?,?,?,?,?)").bind(id, menuId, mime, bytes.byteLength, c.get("user")?.id ?? null).run();
  return `/img/${id}`;
}
var imageParts = (resp) => (resp.candidates?.[0]?.content?.parts ?? []).filter((p) => p.inlineData || p.inline_data);
ai.post("/describe", async (c) => {
  const apiKey = key(c);
  const b = await c.req.json();
  const parts = [];
  if (b.image) parts.push(await loadImagePart(c, b.image));
  parts.push({
    text: `You write menu copy for a luxury private kitchen in Saudi Arabia. Dish name hint: "${str(b.name, "name", { max: 200 })}". Known ingredients: ${(b.ingredients ?? []).join(", ") || "unknown"}.
Return ONLY JSON with this exact shape:
{"name":{"en":"","ar":""},"description":{"en":"2 sentences, sensory, no prices","ar":"\u062C\u0645\u0644\u062A\u0627\u0646 \u0628\u0644\u063A\u0629 \u0628\u064A\u0636\u0627\u0621 \u0631\u0627\u0642\u064A\u0629"},"ingredients":[{"en":"","ar":""}],"nutrition":{"calories":0,"protein":0,"fat":0,"carbohydrates":0,"fiber":0},"suitableFor":["breakfast|lunch|dinner|pre-workout|post-workout|light-meal|high-protein|low-carb"],"coreComponents":["nuts|fish|olive-oil|dairy|vegetables|fruit|legumes|whole-grains"]}
Arabic must be natural Gulf-friendly Modern Standard Arabic. Nutrition is a realistic per-serving estimate.`
  });
  const resp = await gemini(apiKey, TEXT_MODEL, {
    contents: [{ parts }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.7 }
  });
  const text = resp.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "{}";
  try {
    return c.json({ result: JSON.parse(text) });
  } catch {
    throw new HTTPException(502, { message: "AI returned something that was not valid JSON" });
  }
});
ai.post("/translate", async (c) => {
  const apiKey = key(c);
  const b = await c.req.json();
  const text = str(b.text, "text", { max: 4e3, required: true });
  const resp = await gemini(apiKey, TEXT_MODEL, {
    contents: [{ parts: [{ text: `Translate this restaurant menu text to ${b.to === "ar" ? "natural, elegant Arabic (\u0644\u063A\u0629 \u0628\u064A\u0636\u0627\u0621\u060C \u0633\u0644\u0633\u0629 \u0648\u0644\u064A\u0633\u062A \u0631\u0633\u0645\u064A\u0629 \u062C\u0627\u0645\u062F\u0629)" : "natural, elegant English"}. Return only the translation.

${text}` }] }],
    generationConfig: { temperature: 0.3 }
  });
  const out = resp.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
  return c.json({ text: out });
});
ai.post("/hero", async (c) => {
  const apiKey = key(c);
  const b = await c.req.json();
  const img = await loadImagePart(c, str(b.image, "image", { required: true, max: 1e7 }));
  const resp = await gemini(apiKey, IMAGE_MODEL, {
    contents: [{ parts: [img, { text: "Re-render this exact dish as a premium food-delivery hero photo: same plating and food, pure white seamless background, soft natural shadow under the plate, bright even studio lighting, top-down 3/4 angle, square 1:1 composition, no text, no extra props." }] }],
    generationConfig: { responseModalities: ["IMAGE", "TEXT"] }
  });
  const parts = imageParts(resp);
  if (!parts.length) throw new HTTPException(502, { message: "AI did not return an image" });
  return c.json({ image: await saveGeneratedImage(c, parts[0], b.menuId ?? null) });
});
ai.post("/angles", async (c) => {
  const apiKey = key(c);
  const b = await c.req.json();
  const img = await loadImagePart(c, str(b.image, "image", { required: true, max: 1e7 }));
  const prompts = [
    "Same exact dish and plating, photographed straight top-down (flat lay), white background, soft shadow, square.",
    "Same exact dish and plating, low 20-degree side angle showing height and texture, white background, soft shadow, square.",
    "Same exact dish and plating, close macro detail of the most appetizing part, shallow depth of field, white background, square."
  ];
  const out = [];
  for (const p of prompts) {
    const resp = await gemini(apiKey, IMAGE_MODEL, {
      contents: [{ parts: [img, { text: p }] }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] }
    });
    const parts = imageParts(resp);
    if (parts.length) out.push(await saveGeneratedImage(c, parts[0], b.menuId ?? null));
  }
  if (!out.length) throw new HTTPException(502, { message: "AI did not return any images" });
  return c.json({ images: out });
});
ai.post("/generate", async (c) => {
  const apiKey = key(c);
  const b = await c.req.json();
  const prompt = str(b.prompt, "prompt", { required: true, max: 1e3 });
  const resp = await gemini(apiKey, IMAGE_MODEL, {
    contents: [{ parts: [{ text: `Photorealistic premium food photography of: ${prompt}. Plated on fine white ceramic, pure white seamless background, soft natural shadow, bright studio light, square 1:1, no text.` }] }],
    generationConfig: { responseModalities: ["IMAGE", "TEXT"] }
  });
  const parts = imageParts(resp);
  if (!parts.length) throw new HTTPException(502, { message: "AI did not return an image" });
  return c.json({ image: await saveGeneratedImage(c, parts[0], b.menuId ?? null) });
});

// worker/routes/auth.ts
var auth = new Hono3();
auth.get("/status", async (c) => {
  const row = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM users").first();
  return c.json({ needsSetup: (row?.n ?? 0) === 0, appName: c.env.APP_NAME });
});
auth.post("/setup", async (c) => {
  const row = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM users").first();
  if ((row?.n ?? 0) > 0) throw new HTTPException(409, { message: "Setup already completed" });
  const b = await c.req.json();
  const em = email(b.email);
  const pw = str(b.password, "password", { max: 200, required: true });
  if (pw.length < 8) throw new HTTPException(400, { message: "Password must be at least 8 characters" });
  const id = randomId("us");
  await c.env.DB.prepare(
    "INSERT INTO users (id, email, password_hash, first_name, last_name, role, status) VALUES (?,?,?,?,?,?,?)"
  ).bind(id, em, await hashPassword(pw), str(b.firstName, "firstName", { max: 80 }), str(b.lastName, "lastName", { max: 80 }), "admin", "active").run();
  await audit(c.env.DB, id, "setup.admin_created", "user", id);
  await createSession(c, id);
  return c.json({ ok: true });
});
auth.post("/login", async (c) => {
  const b = await c.req.json();
  const em = email(b.email);
  const pw = str(b.password, "password", { max: 200, required: true });
  const u = await c.env.DB.prepare("SELECT id, password_hash, status, role FROM users WHERE email = ?").bind(em).first();
  const ok = u ? await verifyPassword(pw, u.password_hash) : (await verifyPassword(pw, "pbkdf2$1000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="), false);
  if (!ok) throw new HTTPException(401, { message: "Email or password is incorrect" });
  if (u.status !== "active") throw new HTTPException(403, { message: "This account is disabled" });
  await createSession(c, u.id);
  await audit(c.env.DB, u.id, "auth.login");
  return c.json({ ok: true });
});
auth.post("/logout", async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});
auth.get("/me", async (c) => {
  return c.json({ user: c.get("user") });
});
auth.post("/change-password", async (c) => {
  const u = c.get("user");
  if (!u) throw new HTTPException(401, { message: "Sign in required" });
  const b = await c.req.json();
  const current = str(b.currentPassword, "currentPassword", { required: true });
  const next = str(b.newPassword, "newPassword", { required: true });
  if (next.length < 8) throw new HTTPException(400, { message: "Password must be at least 8 characters" });
  const row = await c.env.DB.prepare("SELECT password_hash FROM users WHERE id = ?").bind(u.id).first();
  if (!row || !await verifyPassword(current, row.password_hash)) throw new HTTPException(400, { message: "Current password is incorrect" });
  await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(await hashPassword(next), u.id).run();
  await c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND id != ?").bind(u.id, c.get("sessionId")).run();
  return c.json({ ok: true });
});

// worker/routes/catalog.ts
var catalog = new Hono3();
catalog.use("*", requireRole("admin", "sub-admin", "butler", "chef"));
var SF = SUITABLE_FOR.map((x) => x.id);
var CC = CORE_COMPONENTS.map((x) => x.id);
var canEdit = (role) => role === "admin" || role === "sub-admin";
catalog.get("/menus/:menuId/catalog", async (c) => {
  const menuId = c.req.param("menuId");
  assertMenuAccess(c, menuId);
  const [cats, dishes] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT * FROM categories WHERE menu_id = ? ORDER BY sort_order, created_at").bind(menuId),
    c.env.DB.prepare("SELECT * FROM dishes WHERE menu_id = ? ORDER BY sort_order, created_at").bind(menuId)
  ]);
  return c.json({ categories: cats.results.map(rowToCategory), dishes: dishes.results.map(rowToDish) });
});
catalog.post("/menus/:menuId/categories", async (c) => {
  const menuId = c.req.param("menuId");
  const u = assertMenuAccess(c, menuId);
  if (!canEdit(u.role)) throw new HTTPException(403, { message: "Only admins and sub-admins edit the menu" });
  const b = await c.req.json();
  const id = randomId("ct");
  const max = await c.env.DB.prepare("SELECT COALESCE(MAX(sort_order),0) AS m FROM categories WHERE menu_id = ?").bind(menuId).first();
  await c.env.DB.prepare(
    `INSERT INTO categories (id, menu_id, name, description, image, is_hidden, sort_order, disclaimer_enabled, disclaimer_image, disclaimer_text)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id,
    menuId,
    JSON.stringify(l10n2(b.name, "name", 120)),
    JSON.stringify(l10n2(b.description, "description", 1e3)),
    imageRef(b.image),
    bool(b.isHidden) ? 1 : 0,
    (max?.m ?? 0) + 1,
    bool(b.disclaimerEnabled) ? 1 : 0,
    imageRef(b.disclaimerImage),
    JSON.stringify(l10n2(b.disclaimerText, "disclaimerText", 4e3))
  ).run();
  await touchMenu(c.env.DB, menuId);
  await audit(c.env.DB, u.id, "category.create", "category", id);
  const row = await c.env.DB.prepare("SELECT * FROM categories WHERE id = ?").bind(id).first();
  return c.json({ category: rowToCategory(row) }, 201);
});
catalog.patch("/categories/:id", async (c) => {
  const id = c.req.param("id");
  const cur = await c.env.DB.prepare("SELECT * FROM categories WHERE id = ?").bind(id).first();
  if (!cur) throw new HTTPException(404, { message: "Category not found" });
  const u = assertMenuAccess(c, cur.menu_id);
  if (!canEdit(u.role)) throw new HTTPException(403, { message: "Only admins and sub-admins edit the menu" });
  const b = await c.req.json();
  const cat = rowToCategory(cur);
  await c.env.DB.prepare(
    `UPDATE categories SET name=?, description=?, image=?, is_hidden=?, disclaimer_enabled=?, disclaimer_image=?, disclaimer_text=?, updated_at=? WHERE id=?`
  ).bind(
    JSON.stringify(b.name !== void 0 ? l10n2(b.name, "name", 120) : cat.name),
    JSON.stringify(b.description !== void 0 ? l10n2(b.description, "description", 1e3) : cat.description),
    b.image !== void 0 ? imageRef(b.image) : cat.image,
    bool(b.isHidden, cat.isHidden) ? 1 : 0,
    bool(b.disclaimerEnabled, cat.disclaimerEnabled) ? 1 : 0,
    b.disclaimerImage !== void 0 ? imageRef(b.disclaimerImage) : cat.disclaimerImage,
    JSON.stringify(b.disclaimerText !== void 0 ? l10n2(b.disclaimerText, "disclaimerText", 4e3) : cat.disclaimerText),
    now(),
    id
  ).run();
  await touchMenu(c.env.DB, cur.menu_id);
  const row = await c.env.DB.prepare("SELECT * FROM categories WHERE id = ?").bind(id).first();
  return c.json({ category: rowToCategory(row) });
});
catalog.delete("/categories/:id", async (c) => {
  const id = c.req.param("id");
  const cur = await c.env.DB.prepare("SELECT * FROM categories WHERE id = ?").bind(id).first();
  if (!cur) throw new HTTPException(404, { message: "Category not found" });
  const u = assertMenuAccess(c, cur.menu_id);
  if (!canEdit(u.role)) throw new HTTPException(403, { message: "Only admins and sub-admins edit the menu" });
  const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM dishes WHERE category_id = ?").bind(id).first();
  if ((count?.n ?? 0) > 0 && !c.req.query("force")) {
    throw new HTTPException(409, { message: `This category still has ${count.n} dishes. Move them first or delete with force.` });
  }
  await c.env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
  await touchMenu(c.env.DB, cur.menu_id);
  await audit(c.env.DB, u.id, "category.delete", "category", id);
  return c.json({ ok: true });
});
catalog.post("/menus/:menuId/categories/reorder", async (c) => {
  const menuId = c.req.param("menuId");
  const u = assertMenuAccess(c, menuId);
  if (!canEdit(u.role)) throw new HTTPException(403, { message: "Only admins and sub-admins edit the menu" });
  const { ids } = await c.req.json();
  if (!Array.isArray(ids)) bad("ids must be a list");
  await c.env.DB.batch(ids.map((id, i) => c.env.DB.prepare("UPDATE categories SET sort_order=? WHERE id=? AND menu_id=?").bind(i + 1, id, menuId)));
  await touchMenu(c.env.DB, menuId);
  return c.json({ ok: true });
});
function dishFields(b, cur) {
  const nutritionIn = b.nutrition ?? {};
  const nutrition = cur?.nutrition ?? { calories: 0, protein: 0, fat: 0, carbohydrates: 0, fiber: 0 };
  return {
    name: JSON.stringify(b.name !== void 0 ? l10n2(b.name, "name", 160) : cur?.name ?? { en: "", ar: "" }),
    description: JSON.stringify(b.description !== void 0 ? l10n2(b.description, "description", 2e3) : cur?.description ?? { en: "", ar: "" }),
    extra_info: JSON.stringify(b.extraInfo !== void 0 ? l10n2(b.extraInfo, "extraInfo", 2e3) : cur?.extraInfo ?? { en: "", ar: "" }),
    image: b.image !== void 0 ? imageRef(b.image) : cur?.image ?? null,
    angle_images: JSON.stringify(b.angleImages !== void 0 ? strList(b.angleImages, "angleImages").map((x) => imageRef(x)).filter(Boolean).slice(0, 3) : cur?.angleImages ?? []),
    ingredients: JSON.stringify(b.ingredients !== void 0 ? l10nList(b.ingredients, "ingredients") : cur?.ingredients ?? []),
    side_dishes: JSON.stringify(b.sideDishes !== void 0 ? l10nList(b.sideDishes, "sideDishes") : cur?.sideDishes ?? []),
    nutrition: JSON.stringify(
      b.nutrition !== void 0 ? {
        calories: num(nutritionIn.calories, "calories"),
        protein: num(nutritionIn.protein, "protein"),
        fat: num(nutritionIn.fat, "fat"),
        carbohydrates: num(nutritionIn.carbohydrates, "carbohydrates"),
        fiber: num(nutritionIn.fiber, "fiber")
      } : nutrition
    ),
    suitable_for: JSON.stringify(b.suitableFor !== void 0 ? strList(b.suitableFor, "suitableFor", SF) : cur?.suitableFor ?? []),
    core_components: JSON.stringify(b.coreComponents !== void 0 ? strList(b.coreComponents, "coreComponents", CC) : cur?.coreComponents ?? []),
    tags: JSON.stringify(
      b.tags !== void 0 ? (Array.isArray(b.tags) ? b.tags : []).slice(0, 4).map((t) => ({
        label: l10n2(t?.label, "tag.label", 40),
        color: /^#[0-9a-fA-F]{6}$/.test(String(t?.color)) ? String(t.color) : "#B08D57"
      })) : cur?.tags ?? []
    ),
    recommended_dish_ids: JSON.stringify(b.recommendedDishIds !== void 0 ? strList(b.recommendedDishIds, "recommendedDishIds").slice(0, 6) : cur?.recommendedDishIds ?? []),
    is_hidden: bool(b.isHidden, cur?.isHidden ?? false) ? 1 : 0,
    is_featured: bool(b.isFeatured, cur?.isFeatured ?? false) ? 1 : 0
  };
}
catalog.post("/menus/:menuId/dishes", async (c) => {
  const menuId = c.req.param("menuId");
  const u = assertMenuAccess(c, menuId);
  if (!canEdit(u.role)) throw new HTTPException(403, { message: "Only admins and sub-admins edit the menu" });
  const b = await c.req.json();
  const categoryId = str(b.categoryId, "categoryId", { required: true });
  const cat = await c.env.DB.prepare("SELECT id FROM categories WHERE id = ? AND menu_id = ?").bind(categoryId, menuId).first();
  if (!cat) throw new HTTPException(404, { message: "Category not found in this menu" });
  const f = dishFields(b);
  const id = randomId("ds");
  const max = await c.env.DB.prepare("SELECT COALESCE(MAX(sort_order),0) AS m FROM dishes WHERE category_id = ?").bind(categoryId).first();
  await c.env.DB.prepare(
    `INSERT INTO dishes (id, menu_id, category_id, name, description, extra_info, image, angle_images, ingredients, side_dishes, nutrition,
       suitable_for, core_components, tags, recommended_dish_ids, is_hidden, is_featured, sort_order)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id,
    menuId,
    categoryId,
    f.name,
    f.description,
    f.extra_info,
    f.image,
    f.angle_images,
    f.ingredients,
    f.side_dishes,
    f.nutrition,
    f.suitable_for,
    f.core_components,
    f.tags,
    f.recommended_dish_ids,
    f.is_hidden,
    f.is_featured,
    (max?.m ?? 0) + 1
  ).run();
  await touchMenu(c.env.DB, menuId);
  await audit(c.env.DB, u.id, "dish.create", "dish", id);
  const row = await c.env.DB.prepare("SELECT * FROM dishes WHERE id = ?").bind(id).first();
  return c.json({ dish: rowToDish(row) }, 201);
});
catalog.patch("/dishes/:id", async (c) => {
  const id = c.req.param("id");
  const curRow = await c.env.DB.prepare("SELECT * FROM dishes WHERE id = ?").bind(id).first();
  if (!curRow) throw new HTTPException(404, { message: "Dish not found" });
  const u = assertMenuAccess(c, curRow.menu_id);
  if (!canEdit(u.role)) throw new HTTPException(403, { message: "Only admins and sub-admins edit the menu" });
  const b = await c.req.json();
  const cur = rowToDish(curRow);
  let categoryId = cur.categoryId;
  if (b.categoryId !== void 0 && b.categoryId !== cur.categoryId) {
    categoryId = str(b.categoryId, "categoryId", { required: true });
    const cat = await c.env.DB.prepare("SELECT id FROM categories WHERE id = ? AND menu_id = ?").bind(categoryId, cur.menuId).first();
    if (!cat) throw new HTTPException(404, { message: "Target category not found in this menu" });
  }
  if (b.expectedUpdatedAt && b.expectedUpdatedAt !== cur.updatedAt) {
    throw new HTTPException(409, { message: "This dish was changed by someone else. Reload and try again." });
  }
  const f = dishFields(b, cur);
  await c.env.DB.prepare(
    `UPDATE dishes SET category_id=?, name=?, description=?, extra_info=?, image=?, angle_images=?, ingredients=?, side_dishes=?, nutrition=?,
       suitable_for=?, core_components=?, tags=?, recommended_dish_ids=?, is_hidden=?, is_featured=?, updated_at=? WHERE id=?`
  ).bind(
    categoryId,
    f.name,
    f.description,
    f.extra_info,
    f.image,
    f.angle_images,
    f.ingredients,
    f.side_dishes,
    f.nutrition,
    f.suitable_for,
    f.core_components,
    f.tags,
    f.recommended_dish_ids,
    f.is_hidden,
    f.is_featured,
    now(),
    id
  ).run();
  await touchMenu(c.env.DB, cur.menuId);
  const row = await c.env.DB.prepare("SELECT * FROM dishes WHERE id = ?").bind(id).first();
  return c.json({ dish: rowToDish(row) });
});
catalog.delete("/dishes/:id", async (c) => {
  const id = c.req.param("id");
  const cur = await c.env.DB.prepare("SELECT menu_id FROM dishes WHERE id = ?").bind(id).first();
  if (!cur) throw new HTTPException(404, { message: "Dish not found" });
  const u = assertMenuAccess(c, cur.menu_id);
  if (!canEdit(u.role)) throw new HTTPException(403, { message: "Only admins and sub-admins edit the menu" });
  await c.env.DB.prepare("DELETE FROM dishes WHERE id = ?").bind(id).run();
  await touchMenu(c.env.DB, cur.menu_id);
  await audit(c.env.DB, u.id, "dish.delete", "dish", id);
  return c.json({ ok: true });
});
catalog.post("/menus/:menuId/dishes/reorder", async (c) => {
  const menuId = c.req.param("menuId");
  const u = assertMenuAccess(c, menuId);
  if (!canEdit(u.role)) throw new HTTPException(403, { message: "Only admins and sub-admins edit the menu" });
  const { ids } = await c.req.json();
  if (!Array.isArray(ids)) bad("ids must be a list");
  await c.env.DB.batch(ids.map((id, i) => c.env.DB.prepare("UPDATE dishes SET sort_order=? WHERE id=? AND menu_id=?").bind(i + 1, id, menuId)));
  await touchMenu(c.env.DB, menuId);
  return c.json({ ok: true });
});
catalog.post("/menus/:menuId/import", async (c) => {
  const menuId = c.req.param("menuId");
  const u = assertMenuAccess(c, menuId);
  if (u.role !== "admin") throw new HTTPException(403, { message: "Admin only" });
  const b = await c.req.json();
  const stmts = [];
  if (b.replace) {
    stmts.push(c.env.DB.prepare("DELETE FROM dishes WHERE menu_id = ?").bind(menuId));
    stmts.push(c.env.DB.prepare("DELETE FROM categories WHERE menu_id = ?").bind(menuId));
  }
  const catIdMap = /* @__PURE__ */ new Map();
  let ci = 0;
  for (const cat of b.categories ?? []) {
    const id = typeof cat.id === "string" && /^[\w-]{3,64}$/.test(cat.id) ? cat.id : randomId("ct");
    catIdMap.set(String(cat.id ?? id), id);
    stmts.push(
      c.env.DB.prepare(
        `INSERT OR REPLACE INTO categories (id, menu_id, name, description, image, is_hidden, sort_order, disclaimer_enabled, disclaimer_image, disclaimer_text)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        id,
        menuId,
        JSON.stringify(l10n2(cat.name, "name", 120)),
        JSON.stringify(l10n2(cat.description, "description", 1e3)),
        imageRef(cat.image),
        bool(cat.isHidden) ? 1 : 0,
        num(cat.sortOrder, "sortOrder", ++ci),
        bool(cat.disclaimerEnabled) ? 1 : 0,
        imageRef(cat.disclaimerImage),
        JSON.stringify(l10n2(cat.disclaimerText, "disclaimerText", 4e3))
      )
    );
  }
  let di = 0;
  for (const d of b.dishes ?? []) {
    const categoryId = catIdMap.get(String(d.categoryId)) ?? d.categoryId;
    if (!categoryId) continue;
    const id = typeof d.id === "string" && /^[\w-]{3,64}$/.test(d.id) ? d.id : randomId("ds");
    const f = dishFields(d);
    stmts.push(
      c.env.DB.prepare(
        `INSERT OR REPLACE INTO dishes (id, menu_id, category_id, name, description, extra_info, image, angle_images, ingredients, side_dishes, nutrition,
           suitable_for, core_components, tags, recommended_dish_ids, is_hidden, is_featured, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        id,
        menuId,
        categoryId,
        f.name,
        f.description,
        f.extra_info,
        f.image,
        f.angle_images,
        f.ingredients,
        f.side_dishes,
        f.nutrition,
        f.suitable_for,
        f.core_components,
        f.tags,
        f.recommended_dish_ids,
        f.is_hidden,
        f.is_featured,
        num(d.sortOrder, "sortOrder", ++di)
      )
    );
  }
  for (let i = 0; i < stmts.length; i += 50) await c.env.DB.batch(stmts.slice(i, i + 50));
  await touchMenu(c.env.DB, menuId);
  await audit(c.env.DB, u.id, "catalog.import", "menu", menuId, { categories: b.categories?.length ?? 0, dishes: b.dishes?.length ?? 0 });
  return c.json({ ok: true, categories: b.categories?.length ?? 0, dishes: b.dishes?.length ?? 0 });
});

// worker/routes/images.ts
var images = new Hono3();
var MAX_BYTES = 8 * 1024 * 1024;
var ALLOWED = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/svg+xml"]);
async function store(c, bytes, contentType, menuId) {
  if (!ALLOWED.has(contentType)) throw new HTTPException(415, { message: `Unsupported image type ${contentType}` });
  if (bytes.byteLength > MAX_BYTES) throw new HTTPException(413, { message: "Image is larger than 8 MB" });
  const id = randomId("img");
  await putImage(c.env.IMAGES, id, bytes, contentType);
  await c.env.DB.prepare("INSERT INTO images (id, menu_id, content_type, bytes, created_by) VALUES (?,?,?,?,?)").bind(id, menuId, contentType, bytes.byteLength, c.get("user")?.id ?? null).run();
  return { id, url: `/img/${id}`, bytes: bytes.byteLength, contentType };
}
images.post("/", requireRole("admin", "sub-admin"), async (c) => {
  const form = await c.req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") throw new HTTPException(400, { message: "file is required" });
  const menuId = typeof form.get("menuId") === "string" ? String(form.get("menuId")) : null;
  return c.json(await store(c, await file.arrayBuffer(), file.type || "application/octet-stream", menuId), 201);
});
images.post("/data-url", requireRole("admin", "sub-admin"), async (c) => {
  const b = await c.req.json();
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(b.dataUrl ?? "");
  if (!m) throw new HTTPException(400, { message: "dataUrl must be a base64 image data URL" });
  const bytes = Uint8Array.from(atob(m[2]), (ch) => ch.charCodeAt(0));
  return c.json(await store(c, bytes.buffer, m[1].toLowerCase(), b.menuId ?? null), 201);
});
images.post("/from-url", requireRole("admin"), async (c) => {
  const b = await c.req.json();
  let url;
  try {
    url = new URL(b.url);
  } catch {
    throw new HTTPException(400, { message: "url is not valid" });
  }
  if (url.protocol !== "https:") throw new HTTPException(400, { message: "Only https URLs are allowed" });
  const res = await fetch(url.toString(), { headers: { accept: "image/*" } });
  if (!res.ok) throw new HTTPException(502, { message: `Remote image returned ${res.status}` });
  const ct = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  return c.json(await store(c, await res.arrayBuffer(), ct, b.menuId ?? null), 201);
});
images.delete("/:id", requireRole("admin", "sub-admin"), async (c) => {
  const id = c.req.param("id");
  await deleteImage(c.env.IMAGES, id);
  await c.env.DB.prepare("DELETE FROM images WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});
async function serveImage(c) {
  const id = c.req.param("id");
  if (!/^img_[a-z0-9]+$/.test(id)) return c.notFound();
  const etag = `"${id}"`;
  if (c.req.header("if-none-match") === etag) return new Response(null, { status: 304 });
  const obj = await getImage(c.env.IMAGES, id);
  if (!obj) return c.notFound();
  const headers = new Headers();
  headers.set("content-type", obj.contentType);
  headers.set("etag", etag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(obj.bytes, { headers });
}

// worker/routes/orders.ts
var orders = new Hono3();
orders.use("*", requireRole("admin", "butler", "chef"));
var seesInternal = (role) => role === "admin" || role === "butler";
orders.get("/menus/:menuId/orders", async (c) => {
  const menuId = c.req.param("menuId");
  const u = assertMenuAccess(c, menuId);
  const since = c.req.query("since");
  const scope = c.req.query("scope") ?? "all";
  let sql = "SELECT * FROM orders WHERE menu_id = ?";
  const args = [menuId];
  if (u.role === "chef") {
    sql += ` AND (status IN ('submitted','preparing') OR (status IN ('ready','rejected') AND updated_at > ?))`;
    args.push(new Date(Date.now() - 6 * 36e5).toISOString());
  } else if (scope === "active") {
    sql += ` AND status IN ('draft','submitted','preparing','ready','out_for_delivery','delivered')`;
  } else if (scope === "closed") {
    sql += ` AND status IN ('completed','cancelled','rejected')`;
  }
  if (since) {
    sql += " AND updated_at > ?";
    args.push(since);
  }
  sql += " ORDER BY updated_at DESC LIMIT 300";
  const rows = await c.env.DB.prepare(sql).bind(...args).all();
  return c.json({ orders: rows.results.map((r) => rowToOrder(r, seesInternal(u.role))), serverTime: now() });
});
function parseItems(v) {
  if (!Array.isArray(v) || v.length === 0) bad("An order needs at least one dish");
  return v.map((it, i) => ({
    dishId: str(it.dishId, `items[${i}].dishId`, { required: true }),
    name: l10n2(it.name, `items[${i}].name`, 160),
    quantity: Math.max(1, Math.min(99, Math.round(num(it.quantity, "quantity", 1)))),
    notes: str(it.notes, `items[${i}].notes`, { max: 500 })
  }));
}
orders.post("/menus/:menuId/orders", async (c) => {
  const menuId = c.req.param("menuId");
  const u = assertMenuAccess(c, menuId);
  if (u.role === "chef") throw new HTTPException(403, { message: "Chefs do not create orders" });
  const b = await c.req.json();
  const items = parseItems(b.items);
  const ids = items.map((i) => i.dishId);
  const dishRows = await c.env.DB.prepare(`SELECT id, name FROM dishes WHERE menu_id = ? AND id IN (${ids.map(() => "?").join(",")})`).bind(menuId, ...ids).all();
  const nameById = new Map(dishRows.results.map((r) => [r.id, JSON.parse(r.name)]));
  for (const it of items) {
    if (!nameById.has(it.dishId)) bad("One of the dishes no longer exists");
    it.name = nameById.get(it.dishId);
  }
  const status = b.status === "submitted" ? "submitted" : "draft";
  const id = randomId("or");
  const nextNo = await c.env.DB.prepare("SELECT COALESCE(MAX(number),0)+1 AS n FROM orders WHERE menu_id = ?").bind(menuId).first();
  const ev = [{ at: now(), by: displayName(u), from: null, to: status }];
  await c.env.DB.prepare(
    `INSERT INTO orders (id, menu_id, number, status, customer_name, customer_contact, delivery_at, special_instructions, internal_notes, items, events, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id,
    menuId,
    nextNo?.n ?? 1,
    status,
    str(b.customerName, "customerName", { max: 120, required: true }),
    str(b.customerContact, "customerContact", { max: 200 }),
    b.deliveryAt ? new Date(b.deliveryAt).toISOString() : null,
    str(b.specialInstructions, "specialInstructions", { max: 2e3 }),
    str(b.internalNotes, "internalNotes", { max: 2e3 }),
    JSON.stringify(items),
    JSON.stringify(ev),
    u.id
  ).run();
  await audit(c.env.DB, u.id, "order.create", "order", id, { status });
  const row = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
  return c.json({ order: rowToOrder(row, true) }, 201);
});
orders.patch("/orders/:id", async (c) => {
  const id = c.req.param("id");
  const cur = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
  if (!cur) throw new HTTPException(404, { message: "Order not found" });
  const u = assertMenuAccess(c, cur.menu_id);
  if (u.role === "chef") throw new HTTPException(403, { message: "Chefs do not edit orders" });
  if (!["draft", "submitted"].includes(cur.status)) throw new HTTPException(409, { message: "Only draft or submitted orders can be edited" });
  const b = await c.req.json();
  const items = b.items !== void 0 ? parseItems(b.items) : JSON.parse(cur.items);
  await c.env.DB.prepare(
    `UPDATE orders SET customer_name=?, customer_contact=?, delivery_at=?, special_instructions=?, internal_notes=?, items=?, updated_at=? WHERE id=?`
  ).bind(
    b.customerName !== void 0 ? str(b.customerName, "customerName", { max: 120, required: true }) : cur.customer_name,
    b.customerContact !== void 0 ? str(b.customerContact, "customerContact", { max: 200 }) : cur.customer_contact,
    b.deliveryAt !== void 0 ? b.deliveryAt ? new Date(b.deliveryAt).toISOString() : null : cur.delivery_at,
    b.specialInstructions !== void 0 ? str(b.specialInstructions, "specialInstructions", { max: 2e3 }) : cur.special_instructions,
    b.internalNotes !== void 0 ? str(b.internalNotes, "internalNotes", { max: 2e3 }) : cur.internal_notes,
    JSON.stringify(items),
    now(),
    id
  ).run();
  const row = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
  return c.json({ order: rowToOrder(row, true) });
});
orders.post("/orders/:id/transition", async (c) => {
  const id = c.req.param("id");
  const cur = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
  if (!cur) throw new HTTPException(404, { message: "Order not found" });
  const u = assertMenuAccess(c, cur.menu_id);
  const { to } = await c.req.json();
  const from = cur.status;
  const allowed = TRANSITIONS[from]?.find((t) => t.to === to);
  if (!allowed) throw new HTTPException(409, { message: `Cannot move an order from "${from}" to "${to}"` });
  if (!allowed.roles.includes(u.role)) throw new HTTPException(403, { message: `Your role cannot move an order to "${to}"` });
  const events = [...JSON.parse(cur.events), { at: now(), by: displayName(u), from, to }];
  const res = await c.env.DB.prepare("UPDATE orders SET status=?, events=?, updated_at=? WHERE id=? AND status=?").bind(to, JSON.stringify(events), now(), id, from).run();
  if (!res.meta.changes) throw new HTTPException(409, { message: "Order was updated by someone else \u2014 refresh" });
  await audit(c.env.DB, u.id, "order.transition", "order", id, { from, to });
  const row = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
  return c.json({ order: rowToOrder(row, seesInternal(u.role)) });
});
orders.delete("/orders/:id", async (c) => {
  const id = c.req.param("id");
  const cur = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
  if (!cur) throw new HTTPException(404, { message: "Order not found" });
  const u = assertMenuAccess(c, cur.menu_id);
  if (u.role === "chef") throw new HTTPException(403, { message: "Chefs do not delete orders" });
  if (!["completed", "cancelled", "rejected", "draft"].includes(cur.status)) throw new HTTPException(409, { message: "Only draft or closed orders can be deleted" });
  await c.env.DB.prepare("DELETE FROM orders WHERE id = ?").bind(id).run();
  await audit(c.env.DB, u.id, "order.delete", "order", id);
  return c.json({ ok: true });
});

// worker/routes/public.ts
var pub = new Hono3();
async function resolveMenu(db, slug2) {
  const row = await db.prepare(`SELECT m.* FROM menus m JOIN clients c ON c.id = m.client_id
                                WHERE m.slug = ? AND m.status = 'active' AND c.status = 'active'`).bind(slug2).first();
  if (!row) throw new HTTPException(404, { message: "Menu not found" });
  return rowToMenu(row);
}
async function checkDevice(db, menuId, token) {
  if (!token) return null;
  const hash = await sha256Hex(token.trim());
  const dev = await db.prepare(`SELECT id, last_seen_at FROM devices WHERE menu_id = ? AND token_hash = ? AND status = 'active'`).bind(menuId, hash).first();
  if (!dev) return null;
  if (!dev.last_seen_at || Date.now() - new Date(dev.last_seen_at).getTime() > 5 * 6e4) {
    await db.prepare("UPDATE devices SET last_seen_at = ? WHERE id = ?").bind(now(), dev.id).run();
  }
  return dev.id;
}
pub.get("/menu/:slug/gate", async (c) => {
  const menu = await resolveMenu(c.env.DB, c.req.param("slug"));
  const token = c.req.header("x-device-token");
  const deviceId = menu.settings.openAccess ? "open" : await checkDevice(c.env.DB, menu.id, token);
  return c.json({
    openAccess: menu.settings.openAccess,
    authorized: !!deviceId,
    title: menu.settings.title,
    logoImage: menu.settings.logoImage,
    theme: menu.settings.theme,
    defaultLang: menu.settings.defaultLang
  });
});
pub.get("/menu/:slug/version", async (c) => {
  const menu = await resolveMenu(c.env.DB, c.req.param("slug"));
  return c.json({ contentUpdatedAt: menu.contentUpdatedAt });
});
pub.get("/menu/:slug", async (c) => {
  const menu = await resolveMenu(c.env.DB, c.req.param("slug"));
  if (!menu.settings.openAccess) {
    const deviceId = await checkDevice(c.env.DB, menu.id, c.req.header("x-device-token"));
    if (!deviceId) throw new HTTPException(401, { message: "Device access required" });
  }
  const etag = `"${menu.contentUpdatedAt ?? "0"}"`;
  if (c.req.header("if-none-match") === etag) return new Response(null, { status: 304 });
  const [cats, dishes] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT * FROM categories WHERE menu_id = ? AND is_hidden = 0 ORDER BY sort_order, created_at").bind(menu.id),
    c.env.DB.prepare("SELECT * FROM dishes WHERE menu_id = ? AND is_hidden = 0 ORDER BY sort_order, created_at").bind(menu.id)
  ]);
  const visibleCats = cats.results.map(rowToCategory);
  const catIds = new Set(visibleCats.map((x) => x.id));
  const bundle = {
    menu: { id: menu.id, slug: menu.slug, name: menu.name, settings: { ...menu.settings, openAccess: menu.settings.openAccess }, contentUpdatedAt: menu.contentUpdatedAt },
    categories: visibleCats,
    dishes: dishes.results.map(rowToDish).filter((d) => catIds.has(d.categoryId))
  };
  c.header("etag", etag);
  c.header("cache-control", "private, no-cache");
  return c.json(bundle);
});

// worker/index.ts
var app = new Hono3();
app.use("*", async (c, next) => {
  await next();
  c.header("x-content-type-options", "nosniff");
  c.header("referrer-policy", "strict-origin-when-cross-origin");
  c.header("x-frame-options", "SAMEORIGIN");
});
app.use("/api/*", async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const origin = c.req.header("origin");
    const host = c.req.header("host");
    if (origin && host) {
      let ok = false;
      try {
        ok = new URL(origin).host === host;
      } catch {
        ok = false;
      }
      if (!ok) throw new HTTPException(403, { message: "Cross-origin request blocked" });
    }
  }
  c.header("cache-control", "no-store");
  await next();
});
app.use("/api/*", sessionLoader);
app.get("/api/health", (c) => c.json({ ok: true, time: (/* @__PURE__ */ new Date()).toISOString() }));
app.route("/api/auth", auth);
app.route("/api/public", pub);
app.route("/api/admin", admin);
app.route("/api/catalog", catalog);
app.route("/api/orders", orders);
app.route("/api/images", images);
app.route("/api/ai", ai);
app.get("/img/:id", serveImage);
app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Something went wrong on the server" }, 500);
});
var worker_default = app;

// server/shims.ts
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";
var toParam = (v) => {
  if (v === void 0 || v === null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number" || typeof v === "string" || typeof v === "bigint") return v;
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  return String(v);
};
var Stmt = class _Stmt {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }
  prepared() {
    return this.db.prepare(this.sql);
  }
  bind(...args) {
    return new _Stmt(this.db, this.sql, args.map(toParam));
  }
  async first(col) {
    const row = this.prepared().get(...this.params);
    if (!row) return null;
    return col ? row[col] : { ...row };
  }
  async all() {
    const rows = this.prepared().all(...this.params);
    return { results: rows.map((r) => ({ ...r })), success: true, meta: {} };
  }
  async run() {
    const r = this.prepared().run(...this.params);
    return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
  /** used by batch(): executes synchronously inside the surrounding transaction */
  runSync() {
    if (/^\s*(SELECT|WITH|PRAGMA)\b/i.test(this.sql) || /\bRETURNING\b/i.test(this.sql)) {
      const rows = this.prepared().all(...this.params);
      return { success: true, results: rows.map((r2) => ({ ...r2 })), meta: { changes: 0, last_row_id: 0 } };
    }
    const r = this.prepared().run(...this.params);
    return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
};
var SqliteD1 = class {
  db;
  constructor(file) {
    this.db = new DatabaseSync(file);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  }
  prepare(sql) {
    return new Stmt(this.db, sql);
  }
  /** D1 batches are atomic — mirror that with a transaction. */
  async batch(stmts) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const out = stmts.map((s) => s.runSync());
      this.db.exec("COMMIT");
      return out;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  async exec(sql) {
    this.db.exec(sql);
    return { count: 0, duration: 0 };
  }
};
function migrate(d1, files) {
  d1.db.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const done = new Set(d1.db.prepare("SELECT name FROM _migrations").all().map((r) => r.name));
  for (const f of files.sort((a, b) => a.name.localeCompare(b.name))) {
    if (done.has(f.name)) continue;
    d1.db.exec("BEGIN");
    try {
      d1.db.exec(f.sql);
      d1.db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(f.name, (/* @__PURE__ */ new Date()).toISOString());
      d1.db.exec("COMMIT");
      console.log(`[db] applied migration ${f.name}`);
    } catch (e) {
      d1.db.exec("ROLLBACK");
      throw e;
    }
  }
}
var SAFE_KEY = /^[A-Za-z0-9_.-]+$/;
var DiskKV = class {
  constructor(dir) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
  }
  path(key2) {
    if (!SAFE_KEY.test(key2)) throw new Error("Invalid storage key");
    return join(this.dir, key2);
  }
  async put(key2, value, opts) {
    const p = this.path(key2);
    const bytes = typeof value === "string" ? Buffer.from(value) : Buffer.from(value instanceof Uint8Array ? value : new Uint8Array(value));
    writeFileSync(p + ".tmp", bytes);
    renameSync(p + ".tmp", p);
    writeFileSync(p + ".json", JSON.stringify(opts?.metadata ?? null));
  }
  async getWithMetadata(key2, _opts) {
    const p = this.path(key2);
    if (!existsSync(p)) return { value: null, metadata: null };
    const buf = readFileSync(p);
    let metadata = null;
    try {
      metadata = JSON.parse(readFileSync(p + ".json", "utf8"));
    } catch {
    }
    return { value: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), metadata };
  }
  async delete(key2) {
    const p = this.path(key2);
    rmSync(p, { force: true });
    rmSync(p + ".json", { force: true });
  }
};

// server/main.ts
var PORT = Number(process.env.PORT ?? 8080);
var HOST = process.env.HOST ?? "127.0.0.1";
var DATA_DIR = resolve(process.env.DATA_DIR ?? "/var/lib/artisan-kitchen");
var APP_DIR = resolve(process.env.APP_DIR ?? process.cwd());
var DIST = join2(APP_DIR, "dist");
mkdirSync2(DATA_DIR, { recursive: true });
var DB = new SqliteD1(join2(DATA_DIR, "kitchen.db"));
var migDir = join2(APP_DIR, "migrations");
migrate(DB, readdirSync(migDir).filter((f) => f.endsWith(".sql")).map((name) => ({ name, sql: readFileSync2(join2(migDir, name), "utf8") })));
var IMAGES = new DiskKV(join2(DATA_DIR, "images"));
var env = {
  DB,
  IMAGES,
  ASSETS: { fetch: () => new Response("Not found", { status: 404 }) },
  APP_NAME: process.env.APP_NAME ?? "Artisan Kitchen",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || void 0
};
var MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8"
};
function sendFile(res, file, method) {
  const ext = extname(file).toLowerCase();
  const isHashed = file.includes(`${sep}assets${sep}`);
  res.writeHead(200, {
    "content-type": MIME[ext] ?? "application/octet-stream",
    "content-length": statSync(file).size,
    "cache-control": isHashed ? "public, max-age=31536000, immutable" : "no-cache",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-frame-options": "SAMEORIGIN"
  });
  if (method === "HEAD") return res.end();
  createReadStream(file).pipe(res);
}
function serveStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  let rel;
  try {
    rel = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, "");
  } catch {
    return false;
  }
  const file = join2(DIST, rel);
  if (!file.startsWith(DIST)) return false;
  if (rel && existsSync2(file) && statSync(file).isFile()) {
    sendFile(res, file, req.method);
    return true;
  }
  if (!extname(rel)) {
    sendFile(res, join2(DIST, "index.html"), req.method);
    return true;
  }
  return false;
}
async function toRequest(req, url) {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else if (v !== void 0) headers.set(k, v);
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : void 0,
    // @ts-expect-error Node's fetch needs this for streamed bodies
    duplex: hasBody ? "half" : void 0
  });
}
async function sendResponse(res, r) {
  const headers = {};
  r.headers.forEach((v, k) => {
    if (k === "set-cookie") return;
    headers[k] = v;
  });
  const cookies = r.headers.getSetCookie?.() ?? [];
  if (cookies.length) headers["set-cookie"] = cookies;
  res.writeHead(r.status, headers);
  if (!r.body) return res.end();
  const buf = Buffer.from(await r.arrayBuffer());
  res.end(buf);
}
var MAX_BODY = 12 * 1024 * 1024;
createServer(async (req, res) => {
  try {
    const proto = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers["x-forwarded-host"] || req.headers.host || `localhost:${PORT}`;
    const url = new URL(req.url ?? "/", `${proto}://${host}`);
    if (Number(req.headers["content-length"] ?? 0) > MAX_BODY) {
      res.writeHead(413).end("Too large");
      return;
    }
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/img/")) {
      const r = await worker_default.fetch(await toRequest(req, url), env, { waitUntil() {
      }, passThroughOnException() {
      } });
      return void await sendResponse(res, r);
    }
    if (serveStatic(req, res, url.pathname)) return;
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Something went wrong on the server" }));
  }
}).listen(PORT, HOST, () => {
  console.log(`[artisan-kitchen] listening on http://${HOST}:${PORT}  data=${DATA_DIR}`);
});
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    try {
      DB.db.close();
    } catch {
    }
    process.exit(0);
  });
}
