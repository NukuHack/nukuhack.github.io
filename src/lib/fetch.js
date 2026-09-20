// fetch.js
// Tiny, dependency-free fetch wrapper with sane defaults, timeouts,
// structured errors, and generics via JSDoc.

/* ──────────────────────────────────────────────────────────────────────────
 * Types (pseudo-TS via JSDoc)
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * @typedef {"GET"|"POST"|"PUT"|"PATCH"|"DELETE"|"HEAD"|"OPTIONS"} HttpMethod
 */

/**
 * @typedef {"auto"|"json"|"text"|"blob"|"arrayBuffer"|"stream"|"response"} ResponseType
 */

/**
 * @typedef {Object} RequestOptions
 * @property {HttpMethod}                  [method]        Default "GET".
 * @property {unknown}                     [body]          Objects are JSON-encoded. FormData/Blob/
 *                                                         ArrayBuffer/URLSearchParams/string/
 *                                                         ReadableStream are sent as-is.
 * @property {Record<string, unknown>}     [query]         null/undefined dropped; arrays repeat.
 * @property {Record<string, string>}      [headers]
 * @property {AbortSignal}                 [signal]
 * @property {number}                      [timeout]       ms; 0 disables. Default 30000.
 * @property {ResponseType}                [responseType]  Default "auto".
 * @property {string}                      [baseUrl]       Overrides module base URL.
 *
 * Any other `fetch` init keys (`credentials`, `mode`, `cache`, `redirect`,
 * `referrer`, `referrerPolicy`, `integrity`, `keepalive`, …) are forwarded.
 */

/**
 * @typedef {Object} ApiErrorInit
 * @property {Record<string, string> | null} [fields]
 * @property {unknown}                       [data]
 * @property {string | null}                 [code]
 * @property {string | null}                 [method]
 * @property {string | null}                 [url]
 * @property {unknown}                       [cause]
 */

/* ──────────────────────────────────────────────────────────────────────────
 * Error
 * ────────────────────────────────────────────────────────────────────────── */

export class ApiError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {ApiErrorInit} [init]
   */
  constructor(status, message, init = {}) {
    super(message);
    this.name = "ApiError";
    /** HTTP status. 0 for network / timeout / abort. */
    this.status = status;
    /** Field-level validation errors, if the server sent them. */
    this.fields = init.fields ?? null;
    /** Raw parsed error payload (or raw text fallback). */
    this.data = init.data ?? null;
    /** NETWORK | TIMEOUT | ABORTED | PARSE_ERROR | INVALID_REQUEST | null */
    this.code = init.code ?? null;
    this.method = init.method ?? null;
    this.url = init.url ?? null;
    if (init.cause !== undefined) this.cause = init.cause;
  }

  /** @returns {boolean} */ get isNetworkError()    { return this.status === 0; }
  /** @returns {boolean} */ get isTimeout()         { return this.code === "TIMEOUT"; }
  /** @returns {boolean} */ get isAborted()         { return this.code === "ABORTED"; }
  /** @returns {boolean} */ get isValidationError() { return this.fields !== null; }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Config
 * ────────────────────────────────────────────────────────────────────────── */

const DEFAULT_TIMEOUT = 30_000;
const NOOP = () => {};

/** @type {string} */
let _baseUrl = "";

/** Set a base URL prepended to relative request paths. @param {string} url */
export function setBaseUrl(url) { _baseUrl = url || ""; }

/** @returns {string} */
export function getBaseUrl() { return _baseUrl; }

/* ──────────────────────────────────────────────────────────────────────────
 * Internals
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * @param {Record<string, unknown> | undefined} query
 * @returns {string}
 */
function buildQuery(query) {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v === undefined || v === null) continue;
        params.append(key, String(v));
      }
    } else {
      params.append(key, String(value));
    }
  }
  return params.toString();
}

/**
 * @param {unknown} body
 * @returns {{ body: BodyInit | undefined, isJson: boolean }}
 */
function prepareBody(body) {
  if (body === undefined || body === null) return { body: undefined, isJson: false };
  if (typeof body === "string") return { body, isJson: false };
  if (
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body) ||
    body instanceof URLSearchParams ||
    (typeof ReadableStream !== "undefined" && body instanceof ReadableStream)
  ) {
    return { body: /** @type {BodyInit} */ (body), isJson: false };
  }
  return { body: JSON.stringify(body), isJson: true };
}

/**
 * Combine a user signal with a timeout. Returns a signal plus a cleanup fn.
 * @param {number} timeout
 * @param {AbortSignal | undefined} userSignal
 */
function createSignal(timeout, userSignal) {
  if (!timeout || timeout <= 0) {
    return { signal: userSignal, didTimeout: () => false, cleanup: NOOP };
  }
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException("Request timed out", "TimeoutError"));
  }, timeout);

  /** @type {(() => void) | null} */
  let forwardAbort = null;
  if (userSignal) {
    if (userSignal.aborted) {
      controller.abort(userSignal.reason);
    } else {
      forwardAbort = () => controller.abort(userSignal.reason);
      userSignal.addEventListener("abort", forwardAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      if (userSignal && forwardAbort) {
        userSignal.removeEventListener("abort", forwardAbort);
      }
    },
  };
}

/**
 * @param {unknown} err
 * @param {string} method
 * @param {string} url
 * @param {() => boolean} didTimeout
 * @returns {ApiError}
 */
function normalizeFetchError(err, method, url, didTimeout) {
  if (err instanceof ApiError) return err;

  const isDomException = typeof DOMException !== "undefined" && err instanceof DOMException;
  const name = isDomException ? err.name : "";

  if (didTimeout() || name === "TimeoutError") {
    return new ApiError(0, "Request timed out", { code: "TIMEOUT", method, url, cause: err });
  }
  if (name === "AbortError") {
    return new ApiError(0, "Request was aborted", { code: "ABORTED", method, url, cause: err });
  }
  return new ApiError(
    0,
    err instanceof Error && err.message ? err.message : "Network request failed",
    { code: "NETWORK", method, url, cause: err },
  );
}

/* ── Error payload parsing ───────────────────────────────────────────────── */

const MESSAGE_KEYS = /** @type {const} */ ([
  "error", "message", "detail", "title", "error_description", "reason",
]);
const CONTAINER_KEYS = /** @type {const} */ ([
  "errors", "fields", "validation", "violations",
]);

/** @param {unknown} v @returns {string | null} */
function firstString(v) {
  if (typeof v === "string" && v.trim()) return v;
  if (Array.isArray(v)) {
    for (const x of v) if (typeof x === "string" && x.trim()) return x;
  }
  return null;
}

/** @param {unknown} obj @returns {Record<string, string> | null} */
function toFieldMap(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  /** @type {Record<string, string>} */
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const msg = toFieldMessage(v);
    if (msg) out[k] = msg;
  }
  return Object.keys(out).length ? out : null;
}

/** @param {unknown} v @returns {string | null} */
function toFieldMessage(v) {
  if (typeof v === "string") return v.trim() || null;
  if (Array.isArray(v)) {
    const parts = v.map(toFieldMessage).filter(/** @returns {x is string} */ (x) => Boolean(x));
    return parts.length ? parts.join(" ") : null;
  }
  if (v && typeof v === "object") {
    const o = /** @type {Record<string, unknown>} */ (v);
    return firstString(o.message) || firstString(o.detail) || firstString(o.error);
  }
  return null;
}

/**
 * Turn any error response into `{ message, fields }`.
 * @param {unknown} data  Parsed JSON body, if any.
 * @param {string | null} text  Raw text, if any.
 * @param {string} fallback
 * @returns {{ message: string, fields: Record<string, string> | null }}
 */
function extractError(data, text, fallback) {
  let message = null;
  /** @type {Record<string, string> | null} */
  let fields = null;

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = /** @type {Record<string, unknown>} */ (data);

    // Nested field containers first ({ errors: { email: "..." } } etc.)
    for (const key of CONTAINER_KEYS) {
      const nested = obj[key];
      if (nested && typeof nested === "object" && !Array.isArray(nested)) {
        fields = fields || toFieldMap(nested);
      }
    }

    // Direct message keys
    for (const key of MESSAGE_KEYS) {
      const m = firstString(obj[key]);
      if (m) { message = m; break; }
    }

    // Array-of-errors shapes: { errors: [{ message: "..." }] }
    if (!message && Array.isArray(obj.errors) && obj.errors.length) {
      const first = obj.errors[0];
      message =
        firstString(first) ||
        (first && typeof first === "object"
          ? firstString(/** @type {any} */ (first).message) ||
            firstString(/** @type {any} */ (first).detail) ||
            firstString(/** @type {any} */ (first).error)
          : null);
    }

    // Flat field map fallback
    if (!fields) {
      /** @type {Record<string, unknown>} */
      const flat = {};
      for (const [k, v] of Object.entries(obj)) {
        if (/** @type {readonly string[]} */ (MESSAGE_KEYS).includes(k)) continue;
        if (/** @type {readonly string[]} */ (CONTAINER_KEYS).includes(k)) continue;
        flat[k] = v;
      }
      fields = toFieldMap(flat);
    }

    if (!message && fields) message = Object.values(fields)[0];
  } else if (Array.isArray(data) && data.length) {
    const first = data[0];
    message =
      firstString(first) ||
      (first && typeof first === "object"
        ? firstString(/** @type {any} */ (first).message) ||
          firstString(/** @type {any} */ (first).detail)
        : null);
  }

  if (!message && typeof text === "string" && text.trim()) {
    message = text.trim().slice(0, 500);
  }

  return { message: message || fallback, fields };
}

/**
 * @param {Response} res
 * @param {string} method
 * @param {string} url
 * @returns {Promise<ApiError>}
 */
async function parseErrorResponse(res, method, url) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  let data = null;
  let text = null;

  try {
    if (ct.includes("json")) {
      text = await res.text();
      if (text) {
        try { data = JSON.parse(text); } catch { /* keep text */ }
      }
    } else {
      text = await res.text();
    }
  } catch {
    // Body already consumed / stream error. Fall through with what we have.
  }

  const fallback = res.statusText || `Request failed with status ${res.status}`;
  const { message, fields } = extractError(data, text, fallback);

  return new ApiError(res.status, message, { fields, data: data ?? text, method, url });
}

/* ── Success body reading ────────────────────────────────────────────────── */

/**
 * @param {Response} res
 * @param {ResponseType} responseType
 * @param {string} method
 * @param {string} url
 * @returns {Promise<unknown>}
 */
async function readSuccessBody(res, responseType, method, url) {
  if (responseType === "response") return res;
  if (responseType === "stream") return res.body;
  if (res.status === 204 || res.status === 205 || method === "HEAD") return null;

  if (responseType === "blob") return res.blob();
  if (responseType === "arrayBuffer") return res.arrayBuffer();
  if (responseType === "text") {
    const t = await res.text();
    return t === "" ? null : t;
  }

  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const wantsJson = responseType === "json" || ct.includes("json");

  const text = await res.text();
  if (!text) return null;

  if (wantsJson) {
    try {
      return JSON.parse(text);
    } catch (cause) {
      throw new ApiError(res.status, "Failed to parse JSON response", {
        code: "PARSE_ERROR", method, url, data: text, cause,
      });
    }
  }

  // responseType === "auto" and non-JSON content-type: sniff a bit.
  if (responseType === "auto") {
    const head = text.trimStart().charAt(0);
    if (head === "{" || head === "[") {
      try { return JSON.parse(text); } catch { /* not actually JSON */ }
    }
  }
  return text;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Core request
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * @template [T=any]
 * @param {string} path
 * @param {RequestOptions} [options]
 * @returns {Promise<T>}
 */
export async function request(path, options = {}) {
  const {
    method = "GET",
    body,
    query,
    signal,
    headers,
    timeout = DEFAULT_TIMEOUT,
    responseType = "auto",
    baseUrl = _baseUrl,
    ...fetchInit
  } = options;

  const upperMethod = String(method).toUpperCase();

  // Build URL
  let url = /^[a-z][a-z0-9+.-]*:\/\//i.test(path) ? path : `${baseUrl}${path}`;
  const qs = buildQuery(query);
  if (qs) url += (url.includes("?") ? "&" : "?") + qs;

  // Build body
  const prepared = prepareBody(body);
  if (prepared.body !== undefined && (upperMethod === "GET" || upperMethod === "HEAD")) {
    throw new ApiError(0, `Cannot send a body with ${upperMethod} requests`, {
      code: "INVALID_REQUEST", method: upperMethod, url,
    });
  }

  // Build headers
  const finalHeaders = new Headers(headers || {});
  if (!finalHeaders.has("Accept")) finalHeaders.set("Accept", "application/json");
  if (prepared.isJson && !finalHeaders.has("Content-Type")) {
    finalHeaders.set("Content-Type", "application/json");
  }

  const sig = createSignal(timeout, signal);

  try {
    /** @type {Response} */
    let res;
    try {
      res = await fetch(url, {
        ...fetchInit,
        method: upperMethod,
        headers: finalHeaders,
        body: prepared.body,
        signal: sig.signal,
      });
    } catch (err) {
      throw normalizeFetchError(err, upperMethod, url, sig.didTimeout);
    }

    if (!res.ok) {
      throw await parseErrorResponse(res, upperMethod, url);
    }

    return /** @type {T} */ (await readSuccessBody(res, responseType, upperMethod, url));
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw normalizeFetchError(err, upperMethod, url, sig.didTimeout);
  } finally {
    sig.cleanup();
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────────────── */

/** @typedef {Omit<RequestOptions, "method" | "body">} GetOptions */
/** @typedef {Omit<RequestOptions, "method" | "body"> & { body?: unknown }} DelOptions */

export const api = {
  /**
   * @template [T=any]
   * @param {string} path
   * @param {GetOptions} [options]
   * @returns {Promise<T>}
   */
  get: (path, options) => request(path, { ...options, method: "GET" }),

  /**
   * @template [T=any]
   * @param {string} path
   * @param {unknown} [body]
   * @param {GetOptions} [options]
   * @returns {Promise<T>}
   */
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),

  /**
   * @template [T=any]
   * @param {string} path
   * @param {unknown} [body]
   * @param {GetOptions} [options]
   * @returns {Promise<T>}
   */
  put: (path, body, options) => request(path, { ...options, method: "PUT", body }),

  /**
   * @template [T=any]
   * @param {string} path
   * @param {unknown} [body]
   * @param {GetOptions} [options]
   * @returns {Promise<T>}
   */
  patch: (path, body, options) => request(path, { ...options, method: "PATCH", body }),

  /**
   * Body (if any) goes in `options.body` so `api.del(path, { query })` still works.
   * @template [T=any]
   * @param {string} path
   * @param {DelOptions} [options]
   * @returns {Promise<T>}
   */
  del: (path, options) => request(path, { ...options, method: "DELETE" }),

  /**
   * @template [T=any]
   * @param {string} path
   * @param {GetOptions} [options]
   * @returns {Promise<T>}
   */
  head: (path, options) => request(path, { ...options, method: "HEAD" }),
};