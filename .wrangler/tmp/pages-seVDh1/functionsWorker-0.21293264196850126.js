var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/admin/users.ts
var json = /* @__PURE__ */ __name((data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json", "x-content-type-options": "nosniff" }
}), "json");
async function readAuthUser(env, request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  return res.json();
}
__name(readAuthUser, "readAuthUser");
async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST")
    return json({ error: "Method not allowed. Use POST." }, 405);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    return json(
      { error: "Not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as Pages secrets." },
      501
    );
  const authUser = await readAuthUser(env, request);
  if (!authUser?.id) return json({ error: "Sign in required." }, 401);
  const profRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?auth_user_id=eq.${authUser.id}&select=id,role`,
    { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }
  );
  const profiles = await profRes.json();
  if (!profiles.length || profiles[0].role !== "super_admin")
    return json({ error: "Admins only." }, 403);
  const serviceHeaders = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json"
  };
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  const action = body.action;
  if (action === "create") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const fullName = String(body.fullName ?? "").trim() || email.split("@")[0];
    const role = String(body.role ?? "viewer");
    if (!email || password.length < 6)
      return json({ error: "Email and a password of at least 6 characters are required." }, 400);
    const created = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: serviceHeaders,
      body: JSON.stringify({ email, password, email_confirm: true })
    });
    const createdJson = await created.json();
    if (!created.ok || !createdJson.id)
      return json({ error: createdJson.msg ?? createdJson.message ?? "Could not create the user." }, 400);
    const profileId = `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    await fetch(`${env.SUPABASE_URL}/rest/v1/profiles`, {
      method: "POST",
      headers: serviceHeaders,
      body: JSON.stringify({
        id: profileId,
        organization_id: "org_afkar",
        email,
        full_name: fullName,
        role,
        auth_user_id: createdJson.id,
        is_active: true
      })
    });
    return json({ ok: true, id: profileId });
  }
  if (action === "update") {
    const id = String(body.id ?? "");
    if (!id) return json({ error: "Profile id required." }, 400);
    const curRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${id}&select=*`,
      { headers: serviceHeaders }
    );
    const cur = (await curRes.json())[0];
    if (!cur) return json({ error: "Profile not found." }, 404);
    const patch = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
    if (body.fullName != null) patch.full_name = String(body.fullName).trim() || cur.full_name;
    if (body.role != null) patch.role = String(body.role);
    if (body.isActive != null) patch.is_active = Boolean(body.isActive);
    await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, {
      method: "PATCH",
      headers: serviceHeaders,
      body: JSON.stringify(patch)
    });
    const newPassword = typeof body.password === "string" ? body.password : "";
    if (newPassword) {
      if (newPassword.length < 6)
        return json({ error: "New password must be at least 6 characters." }, 400);
      if (!cur.auth_user_id) return json({ error: "This member has no login yet." }, 400);
      const upd = await fetch(
        `${env.SUPABASE_URL}/auth/v1/admin/users/${cur.auth_user_id}`,
        {
          method: "PUT",
          headers: serviceHeaders,
          body: JSON.stringify({ password: newPassword })
        }
      );
      if (!upd.ok) {
        const e = await upd.json();
        return json({ error: e.msg ?? "Password update failed." }, 400);
      }
    }
    return json({ ok: true });
  }
  if (action === "delete") {
    const id = String(body.id ?? "");
    if (!id) return json({ error: "Profile id required." }, 400);
    if (id === profiles[0].id)
      return json({ error: "You cannot delete your own account." }, 400);
    const curRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${id}&select=auth_user_id`,
      { headers: serviceHeaders }
    );
    const cur = (await curRes.json())[0];
    await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, {
      method: "DELETE",
      headers: serviceHeaders
    });
    if (cur?.auth_user_id) {
      await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${cur.auth_user_id}`, {
        method: "DELETE",
        headers: serviceHeaders
      });
    }
    return json({ ok: true });
  }
  return json({ error: "Unknown action." }, 400);
}
__name(onRequest, "onRequest");

// api/integrations/status.ts
var CREDENTIALS = {
  google_ads: {
    secret: ["GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_REFRESH_TOKEN"],
    account: "GOOGLE_ADS_CUSTOMER_ID"
  },
  tiktok_ads: {
    secret: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    account: "TIKTOK_ADVERTISER_ID"
  },
  snap_ads: {
    secret: ["SNAP_CLIENT_ID", "SNAP_CLIENT_SECRET", "SNAP_REFRESH_TOKEN"],
    account: "SNAP_AD_ACCOUNT_ID"
  },
  salla: {
    secret: ["SALLA_CLIENT_ID", "SALLA_CLIENT_SECRET", "SALLA_REFRESH_TOKEN"],
    account: "SALLA_STORE_ID"
  }
};
var STAFF = /* @__PURE__ */ new Set(["super_admin", "account_manager", "media_buyer"]);
var json2 = /* @__PURE__ */ __name((b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "x-content-type-options": "nosniff" } }), "json");
async function onRequest2(context) {
  const { request, env } = context;
  if (!["GET", "POST"].includes(request.method)) return json2({ error: "POST/GET only" }, 405);
  const url = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  let role = null;
  if (url && serviceKey && token) {
    try {
      const me = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, authorization: `Bearer ${token}` } });
      if (me.ok) {
        const meJson = await me.json();
        if (meJson.id) {
          const prof = await fetch(`${url}/rest/v1/profiles?auth_user_id=eq.${meJson.id}&select=role`, {
            headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` }
          });
          if (prof.ok) role = (await prof.json())?.[0]?.role ?? null;
        }
      }
    } catch {
      role = null;
    }
  }
  if (!role) return json2({ error: "unauthorized" }, 401);
  if (!STAFF.has(role)) return json2({ error: "forbidden" }, 403);
  const platforms = Object.fromEntries(
    Object.keys(CREDENTIALS).map((id) => {
      const { secret, account } = CREDENTIALS[id];
      const configured = secret.every((k) => Boolean(env[k]));
      return [id, { configured, account: account ? env[account] ?? null : null, missing: configured ? [] : secret.filter((k) => !env[k]) }];
    })
  );
  return json2({ platforms }, 200);
}
__name(onRequest2, "onRequest");

// api/integrations/sync.ts
var json3 = /* @__PURE__ */ __name((b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "x-content-type-options": "nosniff" } }), "json");
var STAFF2 = /* @__PURE__ */ new Set(["super_admin", "account_manager", "media_buyer"]);
async function onRequest3(context) {
  const { request, env } = context;
  if (request.method !== "POST") return json3({ error: "POST only" }, 405);
  const url = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  let role = null;
  if (url && serviceKey && token) {
    try {
      const me = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, authorization: `Bearer ${token}` } });
      if (me.ok) {
        const meJson = await me.json();
        if (meJson.id) {
          const prof = await fetch(`${url}/rest/v1/profiles?auth_user_id=eq.${meJson.id}&select=role`, {
            headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` }
          });
          if (prof.ok) role = (await prof.json())?.[0]?.role ?? null;
        }
      }
    } catch {
      role = null;
    }
  }
  if (!role) return json3({ error: "unauthorized" }, 401);
  if (!STAFF2.has(role)) return json3({ error: "forbidden" }, 403);
  if (!env.ADS_PULLER_URL || !env.ADS_PULLER_TOKEN)
    return json3({ error: "sync_not_configured" }, 501);
  try {
    const res = await fetch(env.ADS_PULLER_URL, {
      method: "POST",
      headers: { "x-puller-token": env.ADS_PULLER_TOKEN },
      signal: AbortSignal.timeout(6e4)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return json3({ error: `puller refused (${res.status})`, detail: text.slice(0, 200) }, 502);
    }
    return json3(await res.json());
  } catch (e) {
    return json3({ error: "could not reach the puller", detail: String(e.message) }, 502);
  }
}
__name(onRequest3, "onRequest");

// ../.wrangler/tmp/pages-seVDh1/functionsRoutes-0.8848293019486758.mjs
var routes = [
  {
    routePath: "/api/admin/users",
    mountPath: "/api/admin",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/integrations/status",
    mountPath: "/api/integrations",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/api/integrations/sync",
    mountPath: "/api/integrations",
    method: "",
    middlewares: [],
    modules: [onRequest3]
  }
];

// C:/Users/Ahmad Abdelrahman/AppData/Roaming/npm/node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// C:/Users/Ahmad Abdelrahman/AppData/Roaming/npm/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
