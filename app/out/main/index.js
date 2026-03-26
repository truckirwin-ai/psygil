"use strict";
const electron = require("electron");
const path = require("path");
const node_crypto = require("node:crypto");
const fs = require("fs");
const node_events = require("node:events");
const node_fs = require("node:fs");
const promises = require("node:fs/promises");
const sp = require("node:path");
const node_stream = require("node:stream");
const node_os = require("node:os");
const net = require("net");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const sp__namespace = /* @__PURE__ */ _interopNamespaceDefault(sp);
const net__namespace = /* @__PURE__ */ _interopNamespaceDefault(net);
const TOKEN_KEYS = {
  ID_TOKEN: "psygil_id_token",
  ACCESS_TOKEN: "psygil_access_token",
  REFRESH_TOKEN: "psygil_refresh_token"
};
let currentSession = null;
function encryptAndStore(key, value) {
  if (!electron.safeStorage.isEncryptionAvailable()) {
    throw new Error("Encryption not available — cannot store tokens securely");
  }
  const encrypted = electron.safeStorage.encryptString(value);
  tokenStore.set(key, encrypted);
}
const tokenStore = /* @__PURE__ */ new Map();
function setTokens(tokens) {
  encryptAndStore(TOKEN_KEYS.ID_TOKEN, tokens.idToken);
  encryptAndStore(TOKEN_KEYS.ACCESS_TOKEN, tokens.accessToken);
  if (tokens.refreshToken) {
    encryptAndStore(TOKEN_KEYS.REFRESH_TOKEN, tokens.refreshToken);
  }
}
function clearTokens() {
  tokenStore.clear();
}
function setSession(session) {
  currentSession = session;
}
function getSession() {
  return currentSession;
}
function clearSession() {
  currentSession = null;
  clearTokens();
}
function getAuthStatus() {
  if (!currentSession) {
    return { is_authenticated: false, session_expired: false };
  }
  const expired = new Date(currentSession.expiresAt) < /* @__PURE__ */ new Date();
  if (expired) {
    return { is_authenticated: false, session_expired: true };
  }
  return {
    is_authenticated: true,
    user_id: currentSession.userId,
    user_name: currentSession.userName,
    user_email: currentSession.email,
    is_active: currentSession.isActive,
    roles: currentSession.roles,
    session_expires_at: currentSession.expiresAt
  };
}
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
function loadAuth0Config() {
  return {
    domain: requireEnv("AUTH0_DOMAIN"),
    clientId: requireEnv("AUTH0_CLIENT_ID"),
    callbackUrl: process.env["AUTH0_CALLBACK_URL"] ?? "psygil://callback",
    logoutUrl: process.env["AUTH0_LOGOUT_URL"] ?? "psygil://logout",
    audience: process.env["AUTH0_AUDIENCE"] || void 0,
    scopes: process.env["AUTH0_SCOPES"] ?? "openid profile email offline_access"
  };
}
function base64UrlEncode(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function generateCodeVerifier() {
  return base64UrlEncode(node_crypto.randomBytes(32));
}
function generateCodeChallenge(verifier) {
  const hash = node_crypto.createHash("sha256").update(verifier).digest();
  return base64UrlEncode(hash);
}
function decodeIdTokenPayload(idToken) {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }
  const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
  return JSON.parse(payload);
}
async function exchangeCodeForTokens(code, codeVerifier) {
  const config = loadAuth0Config();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    code,
    code_verifier: codeVerifier,
    redirect_uri: config.callbackUrl
  });
  if (config.audience) {
    body.set("audience", config.audience);
  }
  const response = await fetch(`https://${config.domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${errorBody}`);
  }
  return await response.json();
}
async function performLogin(parentWindow) {
  const config = loadAuth0Config();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = base64UrlEncode(node_crypto.randomBytes(16));
  const authUrl = new URL(`https://${config.domain}/authorize`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.callbackUrl);
  authUrl.searchParams.set("scope", config.scopes);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);
  if (config.audience) {
    authUrl.searchParams.set("audience", config.audience);
  }
  return new Promise((resolve) => {
    const authWindow = new electron.BrowserWindow({
      width: 480,
      height: 640,
      parent: parentWindow ?? void 0,
      modal: true,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    authWindow.once("ready-to-show", () => authWindow.show());
    const handleCallback = async (url) => {
      try {
        const callbackUrl = new URL(url);
        const returnedState = callbackUrl.searchParams.get("state");
        const code = callbackUrl.searchParams.get("code");
        const error = callbackUrl.searchParams.get("error");
        const notAuthenticated = {
          is_authenticated: false,
          user_id: "",
          user_name: "",
          user_email: "",
          is_active: false
        };
        if (error) {
          resolve(notAuthenticated);
          authWindow.close();
          return;
        }
        if (returnedState !== state) {
          resolve(notAuthenticated);
          authWindow.close();
          return;
        }
        if (!code) {
          resolve(notAuthenticated);
          authWindow.close();
          return;
        }
        const tokens = await exchangeCodeForTokens(code, codeVerifier);
        setTokens({
          idToken: tokens.id_token,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token
        });
        const payload = decodeIdTokenPayload(tokens.id_token);
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1e3).toISOString();
        setSession({
          userId: payload.sub,
          userName: payload.name ?? payload.email ?? "Unknown",
          email: payload.email ?? "",
          roles: payload["https://psygil.com/roles"] ?? ["clinician"],
          isActive: true,
          expiresAt
        });
        resolve({
          is_authenticated: true,
          user_id: payload.sub,
          user_name: payload.name ?? payload.email ?? "Unknown",
          user_email: payload.email ?? "",
          is_active: true
        });
      } catch (err) {
        resolve({
          is_authenticated: false,
          user_id: "",
          user_name: "",
          user_email: "",
          is_active: false
        });
      } finally {
        if (!authWindow.isDestroyed()) {
          authWindow.close();
        }
      }
    };
    authWindow.webContents.on("will-navigate", (_event, url) => {
      if (url.startsWith("psygil://")) {
        void handleCallback(url);
      }
    });
    authWindow.webContents.on("will-redirect", (_event, url) => {
      if (url.startsWith("psygil://")) {
        void handleCallback(url);
      }
    });
    authWindow.on("closed", () => {
      resolve({
        is_authenticated: false,
        user_id: "",
        user_name: "",
        user_email: "",
        is_active: false
      });
    });
    void authWindow.loadURL(authUrl.toString());
  });
}
function performLogout(parentWindow) {
  clearSession();
  const loggedOutAt = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const config = loadAuth0Config();
    const logoutUrl = new URL(`https://${config.domain}/v2/logout`);
    logoutUrl.searchParams.set("client_id", config.clientId);
    logoutUrl.searchParams.set("returnTo", config.logoutUrl);
    const logoutWindow = new electron.BrowserWindow({
      width: 1,
      height: 1,
      show: false,
      parent: parentWindow ?? void 0,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    void logoutWindow.loadURL(logoutUrl.toString());
    setTimeout(() => {
      if (!logoutWindow.isDestroyed()) {
        logoutWindow.close();
      }
    }, 3e3);
  } catch {
  }
  return { logged_out_at: loggedOutAt };
}
function checkLicense() {
  const session = getSession();
  if (!session || !session.isActive) {
    return { is_active: false, license_type: "none", expires_at: null };
  }
  return {
    is_active: true,
    license_type: "trial",
    expires_at: session.expiresAt
  };
}
const EntryTypes = {
  FILE_TYPE: "files",
  DIR_TYPE: "directories",
  FILE_DIR_TYPE: "files_directories",
  EVERYTHING_TYPE: "all"
};
const defaultOptions = {
  root: ".",
  fileFilter: (_entryInfo) => true,
  directoryFilter: (_entryInfo) => true,
  type: EntryTypes.FILE_TYPE,
  lstat: false,
  depth: 2147483648,
  alwaysStat: false,
  highWaterMark: 4096
};
Object.freeze(defaultOptions);
const RECURSIVE_ERROR_CODE = "READDIRP_RECURSIVE_ERROR";
const NORMAL_FLOW_ERRORS = /* @__PURE__ */ new Set(["ENOENT", "EPERM", "EACCES", "ELOOP", RECURSIVE_ERROR_CODE]);
const ALL_TYPES = [
  EntryTypes.DIR_TYPE,
  EntryTypes.EVERYTHING_TYPE,
  EntryTypes.FILE_DIR_TYPE,
  EntryTypes.FILE_TYPE
];
const DIR_TYPES = /* @__PURE__ */ new Set([
  EntryTypes.DIR_TYPE,
  EntryTypes.EVERYTHING_TYPE,
  EntryTypes.FILE_DIR_TYPE
]);
const FILE_TYPES = /* @__PURE__ */ new Set([
  EntryTypes.EVERYTHING_TYPE,
  EntryTypes.FILE_DIR_TYPE,
  EntryTypes.FILE_TYPE
]);
const isNormalFlowError = (error) => NORMAL_FLOW_ERRORS.has(error.code);
const wantBigintFsStats = process.platform === "win32";
const emptyFn = (_entryInfo) => true;
const normalizeFilter = (filter) => {
  if (filter === void 0)
    return emptyFn;
  if (typeof filter === "function")
    return filter;
  if (typeof filter === "string") {
    const fl = filter.trim();
    return (entry) => entry.basename === fl;
  }
  if (Array.isArray(filter)) {
    const trItems = filter.map((item) => item.trim());
    return (entry) => trItems.some((f) => entry.basename === f);
  }
  return emptyFn;
};
class ReaddirpStream extends node_stream.Readable {
  parents;
  reading;
  parent;
  _stat;
  _maxDepth;
  _wantsDir;
  _wantsFile;
  _wantsEverything;
  _root;
  _isDirent;
  _statsProp;
  _rdOptions;
  _fileFilter;
  _directoryFilter;
  constructor(options = {}) {
    super({
      objectMode: true,
      autoDestroy: true,
      highWaterMark: options.highWaterMark
    });
    const opts = { ...defaultOptions, ...options };
    const { root, type } = opts;
    this._fileFilter = normalizeFilter(opts.fileFilter);
    this._directoryFilter = normalizeFilter(opts.directoryFilter);
    const statMethod = opts.lstat ? promises.lstat : promises.stat;
    if (wantBigintFsStats) {
      this._stat = (path2) => statMethod(path2, { bigint: true });
    } else {
      this._stat = statMethod;
    }
    this._maxDepth = opts.depth != null && Number.isSafeInteger(opts.depth) ? opts.depth : defaultOptions.depth;
    this._wantsDir = type ? DIR_TYPES.has(type) : false;
    this._wantsFile = type ? FILE_TYPES.has(type) : false;
    this._wantsEverything = type === EntryTypes.EVERYTHING_TYPE;
    this._root = sp.resolve(root);
    this._isDirent = !opts.alwaysStat;
    this._statsProp = this._isDirent ? "dirent" : "stats";
    this._rdOptions = { encoding: "utf8", withFileTypes: this._isDirent };
    this.parents = [this._exploreDir(root, 1)];
    this.reading = false;
    this.parent = void 0;
  }
  async _read(batch) {
    if (this.reading)
      return;
    this.reading = true;
    try {
      while (!this.destroyed && batch > 0) {
        const par = this.parent;
        const fil = par && par.files;
        if (fil && fil.length > 0) {
          const { path: path2, depth } = par;
          const slice = fil.splice(0, batch).map((dirent) => this._formatEntry(dirent, path2));
          const awaited = await Promise.all(slice);
          for (const entry of awaited) {
            if (!entry)
              continue;
            if (this.destroyed)
              return;
            const entryType = await this._getEntryType(entry);
            if (entryType === "directory" && this._directoryFilter(entry)) {
              if (depth <= this._maxDepth) {
                this.parents.push(this._exploreDir(entry.fullPath, depth + 1));
              }
              if (this._wantsDir) {
                this.push(entry);
                batch--;
              }
            } else if ((entryType === "file" || this._includeAsFile(entry)) && this._fileFilter(entry)) {
              if (this._wantsFile) {
                this.push(entry);
                batch--;
              }
            }
          }
        } else {
          const parent = this.parents.pop();
          if (!parent) {
            this.push(null);
            break;
          }
          this.parent = await parent;
          if (this.destroyed)
            return;
        }
      }
    } catch (error) {
      this.destroy(error);
    } finally {
      this.reading = false;
    }
  }
  async _exploreDir(path2, depth) {
    let files;
    try {
      files = await promises.readdir(path2, this._rdOptions);
    } catch (error) {
      this._onError(error);
    }
    return { files, depth, path: path2 };
  }
  async _formatEntry(dirent, path2) {
    let entry;
    const basename = this._isDirent ? dirent.name : dirent;
    try {
      const fullPath = sp.resolve(sp.join(path2, basename));
      entry = { path: sp.relative(this._root, fullPath), fullPath, basename };
      entry[this._statsProp] = this._isDirent ? dirent : await this._stat(fullPath);
    } catch (err) {
      this._onError(err);
      return;
    }
    return entry;
  }
  _onError(err) {
    if (isNormalFlowError(err) && !this.destroyed) {
      this.emit("warn", err);
    } else {
      this.destroy(err);
    }
  }
  async _getEntryType(entry) {
    if (!entry && this._statsProp in entry) {
      return "";
    }
    const stats = entry[this._statsProp];
    if (stats.isFile())
      return "file";
    if (stats.isDirectory())
      return "directory";
    if (stats && stats.isSymbolicLink()) {
      const full = entry.fullPath;
      try {
        const entryRealPath = await promises.realpath(full);
        const entryRealPathStats = await promises.lstat(entryRealPath);
        if (entryRealPathStats.isFile()) {
          return "file";
        }
        if (entryRealPathStats.isDirectory()) {
          const len = entryRealPath.length;
          if (full.startsWith(entryRealPath) && full.substr(len, 1) === sp.sep) {
            const recursiveError = new Error(`Circular symlink detected: "${full}" points to "${entryRealPath}"`);
            recursiveError.code = RECURSIVE_ERROR_CODE;
            return this._onError(recursiveError);
          }
          return "directory";
        }
      } catch (error) {
        this._onError(error);
        return "";
      }
    }
  }
  _includeAsFile(entry) {
    const stats = entry && entry[this._statsProp];
    return stats && this._wantsEverything && !stats.isDirectory();
  }
}
function readdirp(root, options = {}) {
  let type = options.entryType || options.type;
  if (type === "both")
    type = EntryTypes.FILE_DIR_TYPE;
  if (type)
    options.type = type;
  if (!root) {
    throw new Error("readdirp: root argument is required. Usage: readdirp(root, options)");
  } else if (typeof root !== "string") {
    throw new TypeError("readdirp: root argument must be a string. Usage: readdirp(root, options)");
  } else if (type && !ALL_TYPES.includes(type)) {
    throw new Error(`readdirp: Invalid type passed. Use one of ${ALL_TYPES.join(", ")}`);
  }
  options.root = root;
  return new ReaddirpStream(options);
}
const STR_DATA = "data";
const STR_END = "end";
const STR_CLOSE = "close";
const EMPTY_FN = () => {
};
const pl = process.platform;
const isWindows = pl === "win32";
const isMacos = pl === "darwin";
const isLinux = pl === "linux";
const isFreeBSD = pl === "freebsd";
const isIBMi = node_os.type() === "OS400";
const EVENTS = {
  ALL: "all",
  READY: "ready",
  ADD: "add",
  CHANGE: "change",
  ADD_DIR: "addDir",
  UNLINK: "unlink",
  UNLINK_DIR: "unlinkDir",
  RAW: "raw",
  ERROR: "error"
};
const EV = EVENTS;
const THROTTLE_MODE_WATCH = "watch";
const statMethods = { lstat: promises.lstat, stat: promises.stat };
const KEY_LISTENERS = "listeners";
const KEY_ERR = "errHandlers";
const KEY_RAW = "rawEmitters";
const HANDLER_KEYS = [KEY_LISTENERS, KEY_ERR, KEY_RAW];
const binaryExtensions = /* @__PURE__ */ new Set([
  "3dm",
  "3ds",
  "3g2",
  "3gp",
  "7z",
  "a",
  "aac",
  "adp",
  "afdesign",
  "afphoto",
  "afpub",
  "ai",
  "aif",
  "aiff",
  "alz",
  "ape",
  "apk",
  "appimage",
  "ar",
  "arj",
  "asf",
  "au",
  "avi",
  "bak",
  "baml",
  "bh",
  "bin",
  "bk",
  "bmp",
  "btif",
  "bz2",
  "bzip2",
  "cab",
  "caf",
  "cgm",
  "class",
  "cmx",
  "cpio",
  "cr2",
  "cur",
  "dat",
  "dcm",
  "deb",
  "dex",
  "djvu",
  "dll",
  "dmg",
  "dng",
  "doc",
  "docm",
  "docx",
  "dot",
  "dotm",
  "dra",
  "DS_Store",
  "dsk",
  "dts",
  "dtshd",
  "dvb",
  "dwg",
  "dxf",
  "ecelp4800",
  "ecelp7470",
  "ecelp9600",
  "egg",
  "eol",
  "eot",
  "epub",
  "exe",
  "f4v",
  "fbs",
  "fh",
  "fla",
  "flac",
  "flatpak",
  "fli",
  "flv",
  "fpx",
  "fst",
  "fvt",
  "g3",
  "gh",
  "gif",
  "graffle",
  "gz",
  "gzip",
  "h261",
  "h263",
  "h264",
  "icns",
  "ico",
  "ief",
  "img",
  "ipa",
  "iso",
  "jar",
  "jpeg",
  "jpg",
  "jpgv",
  "jpm",
  "jxr",
  "key",
  "ktx",
  "lha",
  "lib",
  "lvp",
  "lz",
  "lzh",
  "lzma",
  "lzo",
  "m3u",
  "m4a",
  "m4v",
  "mar",
  "mdi",
  "mht",
  "mid",
  "midi",
  "mj2",
  "mka",
  "mkv",
  "mmr",
  "mng",
  "mobi",
  "mov",
  "movie",
  "mp3",
  "mp4",
  "mp4a",
  "mpeg",
  "mpg",
  "mpga",
  "mxu",
  "nef",
  "npx",
  "numbers",
  "nupkg",
  "o",
  "odp",
  "ods",
  "odt",
  "oga",
  "ogg",
  "ogv",
  "otf",
  "ott",
  "pages",
  "pbm",
  "pcx",
  "pdb",
  "pdf",
  "pea",
  "pgm",
  "pic",
  "png",
  "pnm",
  "pot",
  "potm",
  "potx",
  "ppa",
  "ppam",
  "ppm",
  "pps",
  "ppsm",
  "ppsx",
  "ppt",
  "pptm",
  "pptx",
  "psd",
  "pya",
  "pyc",
  "pyo",
  "pyv",
  "qt",
  "rar",
  "ras",
  "raw",
  "resources",
  "rgb",
  "rip",
  "rlc",
  "rmf",
  "rmvb",
  "rpm",
  "rtf",
  "rz",
  "s3m",
  "s7z",
  "scpt",
  "sgi",
  "shar",
  "snap",
  "sil",
  "sketch",
  "slk",
  "smv",
  "snk",
  "so",
  "stl",
  "suo",
  "sub",
  "swf",
  "tar",
  "tbz",
  "tbz2",
  "tga",
  "tgz",
  "thmx",
  "tif",
  "tiff",
  "tlz",
  "ttc",
  "ttf",
  "txz",
  "udf",
  "uvh",
  "uvi",
  "uvm",
  "uvp",
  "uvs",
  "uvu",
  "viv",
  "vob",
  "war",
  "wav",
  "wax",
  "wbmp",
  "wdp",
  "weba",
  "webm",
  "webp",
  "whl",
  "wim",
  "wm",
  "wma",
  "wmv",
  "wmx",
  "woff",
  "woff2",
  "wrm",
  "wvx",
  "xbm",
  "xif",
  "xla",
  "xlam",
  "xls",
  "xlsb",
  "xlsm",
  "xlsx",
  "xlt",
  "xltm",
  "xltx",
  "xm",
  "xmind",
  "xpi",
  "xpm",
  "xwd",
  "xz",
  "z",
  "zip",
  "zipx"
]);
const isBinaryPath = (filePath) => binaryExtensions.has(sp__namespace.extname(filePath).slice(1).toLowerCase());
const foreach = (val, fn) => {
  if (val instanceof Set) {
    val.forEach(fn);
  } else {
    fn(val);
  }
};
const addAndConvert = (main, prop, item) => {
  let container = main[prop];
  if (!(container instanceof Set)) {
    main[prop] = container = /* @__PURE__ */ new Set([container]);
  }
  container.add(item);
};
const clearItem = (cont) => (key) => {
  const set = cont[key];
  if (set instanceof Set) {
    set.clear();
  } else {
    delete cont[key];
  }
};
const delFromSet = (main, prop, item) => {
  const container = main[prop];
  if (container instanceof Set) {
    container.delete(item);
  } else if (container === item) {
    delete main[prop];
  }
};
const isEmptySet = (val) => val instanceof Set ? val.size === 0 : !val;
const FsWatchInstances = /* @__PURE__ */ new Map();
function createFsWatchInstance(path2, options, listener, errHandler, emitRaw) {
  const handleEvent = (rawEvent, evPath) => {
    listener(path2);
    emitRaw(rawEvent, evPath, { watchedPath: path2 });
    if (evPath && path2 !== evPath) {
      fsWatchBroadcast(sp__namespace.resolve(path2, evPath), KEY_LISTENERS, sp__namespace.join(path2, evPath));
    }
  };
  try {
    return node_fs.watch(path2, {
      persistent: options.persistent
    }, handleEvent);
  } catch (error) {
    errHandler(error);
    return void 0;
  }
}
const fsWatchBroadcast = (fullPath, listenerType, val1, val2, val3) => {
  const cont = FsWatchInstances.get(fullPath);
  if (!cont)
    return;
  foreach(cont[listenerType], (listener) => {
    listener(val1, val2, val3);
  });
};
const setFsWatchListener = (path2, fullPath, options, handlers) => {
  const { listener, errHandler, rawEmitter } = handlers;
  let cont = FsWatchInstances.get(fullPath);
  let watcher;
  if (!options.persistent) {
    watcher = createFsWatchInstance(path2, options, listener, errHandler, rawEmitter);
    if (!watcher)
      return;
    return watcher.close.bind(watcher);
  }
  if (cont) {
    addAndConvert(cont, KEY_LISTENERS, listener);
    addAndConvert(cont, KEY_ERR, errHandler);
    addAndConvert(cont, KEY_RAW, rawEmitter);
  } else {
    watcher = createFsWatchInstance(
      path2,
      options,
      fsWatchBroadcast.bind(null, fullPath, KEY_LISTENERS),
      errHandler,
      // no need to use broadcast here
      fsWatchBroadcast.bind(null, fullPath, KEY_RAW)
    );
    if (!watcher)
      return;
    watcher.on(EV.ERROR, async (error) => {
      const broadcastErr = fsWatchBroadcast.bind(null, fullPath, KEY_ERR);
      if (cont)
        cont.watcherUnusable = true;
      if (isWindows && error.code === "EPERM") {
        try {
          const fd = await promises.open(path2, "r");
          await fd.close();
          broadcastErr(error);
        } catch (err) {
        }
      } else {
        broadcastErr(error);
      }
    });
    cont = {
      listeners: listener,
      errHandlers: errHandler,
      rawEmitters: rawEmitter,
      watcher
    };
    FsWatchInstances.set(fullPath, cont);
  }
  return () => {
    delFromSet(cont, KEY_LISTENERS, listener);
    delFromSet(cont, KEY_ERR, errHandler);
    delFromSet(cont, KEY_RAW, rawEmitter);
    if (isEmptySet(cont.listeners)) {
      cont.watcher.close();
      FsWatchInstances.delete(fullPath);
      HANDLER_KEYS.forEach(clearItem(cont));
      cont.watcher = void 0;
      Object.freeze(cont);
    }
  };
};
const FsWatchFileInstances = /* @__PURE__ */ new Map();
const setFsWatchFileListener = (path2, fullPath, options, handlers) => {
  const { listener, rawEmitter } = handlers;
  let cont = FsWatchFileInstances.get(fullPath);
  const copts = cont && cont.options;
  if (copts && (copts.persistent < options.persistent || copts.interval > options.interval)) {
    node_fs.unwatchFile(fullPath);
    cont = void 0;
  }
  if (cont) {
    addAndConvert(cont, KEY_LISTENERS, listener);
    addAndConvert(cont, KEY_RAW, rawEmitter);
  } else {
    cont = {
      listeners: listener,
      rawEmitters: rawEmitter,
      options,
      watcher: node_fs.watchFile(fullPath, options, (curr, prev) => {
        foreach(cont.rawEmitters, (rawEmitter2) => {
          rawEmitter2(EV.CHANGE, fullPath, { curr, prev });
        });
        const currmtime = curr.mtimeMs;
        if (curr.size !== prev.size || currmtime > prev.mtimeMs || currmtime === 0) {
          foreach(cont.listeners, (listener2) => listener2(path2, curr));
        }
      })
    };
    FsWatchFileInstances.set(fullPath, cont);
  }
  return () => {
    delFromSet(cont, KEY_LISTENERS, listener);
    delFromSet(cont, KEY_RAW, rawEmitter);
    if (isEmptySet(cont.listeners)) {
      FsWatchFileInstances.delete(fullPath);
      node_fs.unwatchFile(fullPath);
      cont.options = cont.watcher = void 0;
      Object.freeze(cont);
    }
  };
};
class NodeFsHandler {
  fsw;
  _boundHandleError;
  constructor(fsW) {
    this.fsw = fsW;
    this._boundHandleError = (error) => fsW._handleError(error);
  }
  /**
   * Watch file for changes with fs_watchFile or fs_watch.
   * @param path to file or dir
   * @param listener on fs change
   * @returns closer for the watcher instance
   */
  _watchWithNodeFs(path2, listener) {
    const opts = this.fsw.options;
    const directory = sp__namespace.dirname(path2);
    const basename = sp__namespace.basename(path2);
    const parent = this.fsw._getWatchedDir(directory);
    parent.add(basename);
    const absolutePath = sp__namespace.resolve(path2);
    const options = {
      persistent: opts.persistent
    };
    if (!listener)
      listener = EMPTY_FN;
    let closer;
    if (opts.usePolling) {
      const enableBin = opts.interval !== opts.binaryInterval;
      options.interval = enableBin && isBinaryPath(basename) ? opts.binaryInterval : opts.interval;
      closer = setFsWatchFileListener(path2, absolutePath, options, {
        listener,
        rawEmitter: this.fsw._emitRaw
      });
    } else {
      closer = setFsWatchListener(path2, absolutePath, options, {
        listener,
        errHandler: this._boundHandleError,
        rawEmitter: this.fsw._emitRaw
      });
    }
    return closer;
  }
  /**
   * Watch a file and emit add event if warranted.
   * @returns closer for the watcher instance
   */
  _handleFile(file, stats, initialAdd) {
    if (this.fsw.closed) {
      return;
    }
    const dirname = sp__namespace.dirname(file);
    const basename = sp__namespace.basename(file);
    const parent = this.fsw._getWatchedDir(dirname);
    let prevStats = stats;
    if (parent.has(basename))
      return;
    const listener = async (path2, newStats) => {
      if (!this.fsw._throttle(THROTTLE_MODE_WATCH, file, 5))
        return;
      if (!newStats || newStats.mtimeMs === 0) {
        try {
          const newStats2 = await promises.stat(file);
          if (this.fsw.closed)
            return;
          const at = newStats2.atimeMs;
          const mt = newStats2.mtimeMs;
          if (!at || at <= mt || mt !== prevStats.mtimeMs) {
            this.fsw._emit(EV.CHANGE, file, newStats2);
          }
          if ((isMacos || isLinux || isFreeBSD) && prevStats.ino !== newStats2.ino) {
            this.fsw._closeFile(path2);
            prevStats = newStats2;
            const closer2 = this._watchWithNodeFs(file, listener);
            if (closer2)
              this.fsw._addPathCloser(path2, closer2);
          } else {
            prevStats = newStats2;
          }
        } catch (error) {
          this.fsw._remove(dirname, basename);
        }
      } else if (parent.has(basename)) {
        const at = newStats.atimeMs;
        const mt = newStats.mtimeMs;
        if (!at || at <= mt || mt !== prevStats.mtimeMs) {
          this.fsw._emit(EV.CHANGE, file, newStats);
        }
        prevStats = newStats;
      }
    };
    const closer = this._watchWithNodeFs(file, listener);
    if (!(initialAdd && this.fsw.options.ignoreInitial) && this.fsw._isntIgnored(file)) {
      if (!this.fsw._throttle(EV.ADD, file, 0))
        return;
      this.fsw._emit(EV.ADD, file, stats);
    }
    return closer;
  }
  /**
   * Handle symlinks encountered while reading a dir.
   * @param entry returned by readdirp
   * @param directory path of dir being read
   * @param path of this item
   * @param item basename of this item
   * @returns true if no more processing is needed for this entry.
   */
  async _handleSymlink(entry, directory, path2, item) {
    if (this.fsw.closed) {
      return;
    }
    const full = entry.fullPath;
    const dir = this.fsw._getWatchedDir(directory);
    if (!this.fsw.options.followSymlinks) {
      this.fsw._incrReadyCount();
      let linkPath;
      try {
        linkPath = await promises.realpath(path2);
      } catch (e) {
        this.fsw._emitReady();
        return true;
      }
      if (this.fsw.closed)
        return;
      if (dir.has(item)) {
        if (this.fsw._symlinkPaths.get(full) !== linkPath) {
          this.fsw._symlinkPaths.set(full, linkPath);
          this.fsw._emit(EV.CHANGE, path2, entry.stats);
        }
      } else {
        dir.add(item);
        this.fsw._symlinkPaths.set(full, linkPath);
        this.fsw._emit(EV.ADD, path2, entry.stats);
      }
      this.fsw._emitReady();
      return true;
    }
    if (this.fsw._symlinkPaths.has(full)) {
      return true;
    }
    this.fsw._symlinkPaths.set(full, true);
  }
  _handleRead(directory, initialAdd, wh, target, dir, depth, throttler) {
    directory = sp__namespace.join(directory, "");
    const throttleKey = target ? `${directory}:${target}` : directory;
    throttler = this.fsw._throttle("readdir", throttleKey, 1e3);
    if (!throttler)
      return;
    const previous = this.fsw._getWatchedDir(wh.path);
    const current = /* @__PURE__ */ new Set();
    let stream = this.fsw._readdirp(directory, {
      fileFilter: (entry) => wh.filterPath(entry),
      directoryFilter: (entry) => wh.filterDir(entry)
    });
    if (!stream)
      return;
    stream.on(STR_DATA, async (entry) => {
      if (this.fsw.closed) {
        stream = void 0;
        return;
      }
      const item = entry.path;
      let path2 = sp__namespace.join(directory, item);
      current.add(item);
      if (entry.stats.isSymbolicLink() && await this._handleSymlink(entry, directory, path2, item)) {
        return;
      }
      if (this.fsw.closed) {
        stream = void 0;
        return;
      }
      if (item === target || !target && !previous.has(item)) {
        this.fsw._incrReadyCount();
        path2 = sp__namespace.join(dir, sp__namespace.relative(dir, path2));
        this._addToNodeFs(path2, initialAdd, wh, depth + 1);
      }
    }).on(EV.ERROR, this._boundHandleError);
    return new Promise((resolve, reject) => {
      if (!stream)
        return reject();
      stream.once(STR_END, () => {
        if (this.fsw.closed) {
          stream = void 0;
          return;
        }
        const wasThrottled = throttler ? throttler.clear() : false;
        resolve(void 0);
        previous.getChildren().filter((item) => {
          return item !== directory && !current.has(item);
        }).forEach((item) => {
          this.fsw._remove(directory, item);
        });
        stream = void 0;
        if (wasThrottled)
          this._handleRead(directory, false, wh, target, dir, depth, throttler);
      });
    });
  }
  /**
   * Read directory to add / remove files from `@watched` list and re-read it on change.
   * @param dir fs path
   * @param stats
   * @param initialAdd
   * @param depth relative to user-supplied path
   * @param target child path targeted for watch
   * @param wh Common watch helpers for this path
   * @param realpath
   * @returns closer for the watcher instance.
   */
  async _handleDir(dir, stats, initialAdd, depth, target, wh, realpath) {
    const parentDir = this.fsw._getWatchedDir(sp__namespace.dirname(dir));
    const tracked = parentDir.has(sp__namespace.basename(dir));
    if (!(initialAdd && this.fsw.options.ignoreInitial) && !target && !tracked) {
      this.fsw._emit(EV.ADD_DIR, dir, stats);
    }
    parentDir.add(sp__namespace.basename(dir));
    this.fsw._getWatchedDir(dir);
    let throttler;
    let closer;
    const oDepth = this.fsw.options.depth;
    if ((oDepth == null || depth <= oDepth) && !this.fsw._symlinkPaths.has(realpath)) {
      if (!target) {
        await this._handleRead(dir, initialAdd, wh, target, dir, depth, throttler);
        if (this.fsw.closed)
          return;
      }
      closer = this._watchWithNodeFs(dir, (dirPath, stats2) => {
        if (stats2 && stats2.mtimeMs === 0)
          return;
        this._handleRead(dirPath, false, wh, target, dir, depth, throttler);
      });
    }
    return closer;
  }
  /**
   * Handle added file, directory, or glob pattern.
   * Delegates call to _handleFile / _handleDir after checks.
   * @param path to file or ir
   * @param initialAdd was the file added at watch instantiation?
   * @param priorWh depth relative to user-supplied path
   * @param depth Child path actually targeted for watch
   * @param target Child path actually targeted for watch
   */
  async _addToNodeFs(path2, initialAdd, priorWh, depth, target) {
    const ready = this.fsw._emitReady;
    if (this.fsw._isIgnored(path2) || this.fsw.closed) {
      ready();
      return false;
    }
    const wh = this.fsw._getWatchHelpers(path2);
    if (priorWh) {
      wh.filterPath = (entry) => priorWh.filterPath(entry);
      wh.filterDir = (entry) => priorWh.filterDir(entry);
    }
    try {
      const stats = await statMethods[wh.statMethod](wh.watchPath);
      if (this.fsw.closed)
        return;
      if (this.fsw._isIgnored(wh.watchPath, stats)) {
        ready();
        return false;
      }
      const follow = this.fsw.options.followSymlinks;
      let closer;
      if (stats.isDirectory()) {
        const absPath = sp__namespace.resolve(path2);
        const targetPath = follow ? await promises.realpath(path2) : path2;
        if (this.fsw.closed)
          return;
        closer = await this._handleDir(wh.watchPath, stats, initialAdd, depth, target, wh, targetPath);
        if (this.fsw.closed)
          return;
        if (absPath !== targetPath && targetPath !== void 0) {
          this.fsw._symlinkPaths.set(absPath, targetPath);
        }
      } else if (stats.isSymbolicLink()) {
        const targetPath = follow ? await promises.realpath(path2) : path2;
        if (this.fsw.closed)
          return;
        const parent = sp__namespace.dirname(wh.watchPath);
        this.fsw._getWatchedDir(parent).add(wh.watchPath);
        this.fsw._emit(EV.ADD, wh.watchPath, stats);
        closer = await this._handleDir(parent, stats, initialAdd, depth, path2, wh, targetPath);
        if (this.fsw.closed)
          return;
        if (targetPath !== void 0) {
          this.fsw._symlinkPaths.set(sp__namespace.resolve(path2), targetPath);
        }
      } else {
        closer = this._handleFile(wh.watchPath, stats, initialAdd);
      }
      ready();
      if (closer)
        this.fsw._addPathCloser(path2, closer);
      return false;
    } catch (error) {
      if (this.fsw._handleError(error)) {
        ready();
        return path2;
      }
    }
  }
}
/*! chokidar - MIT License (c) 2012 Paul Miller (paulmillr.com) */
const SLASH = "/";
const SLASH_SLASH = "//";
const ONE_DOT = ".";
const TWO_DOTS = "..";
const STRING_TYPE = "string";
const BACK_SLASH_RE = /\\/g;
const DOUBLE_SLASH_RE = /\/\//g;
const DOT_RE = /\..*\.(sw[px])$|~$|\.subl.*\.tmp/;
const REPLACER_RE = /^\.[/\\]/;
function arrify(item) {
  return Array.isArray(item) ? item : [item];
}
const isMatcherObject = (matcher) => typeof matcher === "object" && matcher !== null && !(matcher instanceof RegExp);
function createPattern(matcher) {
  if (typeof matcher === "function")
    return matcher;
  if (typeof matcher === "string")
    return (string) => matcher === string;
  if (matcher instanceof RegExp)
    return (string) => matcher.test(string);
  if (typeof matcher === "object" && matcher !== null) {
    return (string) => {
      if (matcher.path === string)
        return true;
      if (matcher.recursive) {
        const relative = sp__namespace.relative(matcher.path, string);
        if (!relative) {
          return false;
        }
        return !relative.startsWith("..") && !sp__namespace.isAbsolute(relative);
      }
      return false;
    };
  }
  return () => false;
}
function normalizePath(path2) {
  if (typeof path2 !== "string")
    throw new Error("string expected");
  path2 = sp__namespace.normalize(path2);
  path2 = path2.replace(/\\/g, "/");
  let prepend = false;
  if (path2.startsWith("//"))
    prepend = true;
  path2 = path2.replace(DOUBLE_SLASH_RE, "/");
  if (prepend)
    path2 = "/" + path2;
  return path2;
}
function matchPatterns(patterns, testString, stats) {
  const path2 = normalizePath(testString);
  for (let index = 0; index < patterns.length; index++) {
    const pattern = patterns[index];
    if (pattern(path2, stats)) {
      return true;
    }
  }
  return false;
}
function anymatch(matchers, testString) {
  if (matchers == null) {
    throw new TypeError("anymatch: specify first argument");
  }
  const matchersArray = arrify(matchers);
  const patterns = matchersArray.map((matcher) => createPattern(matcher));
  {
    return (testString2, stats) => {
      return matchPatterns(patterns, testString2, stats);
    };
  }
}
const unifyPaths = (paths_) => {
  const paths = arrify(paths_).flat();
  if (!paths.every((p) => typeof p === STRING_TYPE)) {
    throw new TypeError(`Non-string provided as watch path: ${paths}`);
  }
  return paths.map(normalizePathToUnix);
};
const toUnix = (string) => {
  let str = string.replace(BACK_SLASH_RE, SLASH);
  let prepend = false;
  if (str.startsWith(SLASH_SLASH)) {
    prepend = true;
  }
  str = str.replace(DOUBLE_SLASH_RE, SLASH);
  if (prepend) {
    str = SLASH + str;
  }
  return str;
};
const normalizePathToUnix = (path2) => toUnix(sp__namespace.normalize(toUnix(path2)));
const normalizeIgnored = (cwd = "") => (path2) => {
  if (typeof path2 === "string") {
    return normalizePathToUnix(sp__namespace.isAbsolute(path2) ? path2 : sp__namespace.join(cwd, path2));
  } else {
    return path2;
  }
};
const getAbsolutePath = (path2, cwd) => {
  if (sp__namespace.isAbsolute(path2)) {
    return path2;
  }
  return sp__namespace.join(cwd, path2);
};
const EMPTY_SET = Object.freeze(/* @__PURE__ */ new Set());
class DirEntry {
  path;
  _removeWatcher;
  items;
  constructor(dir, removeWatcher) {
    this.path = dir;
    this._removeWatcher = removeWatcher;
    this.items = /* @__PURE__ */ new Set();
  }
  add(item) {
    const { items } = this;
    if (!items)
      return;
    if (item !== ONE_DOT && item !== TWO_DOTS)
      items.add(item);
  }
  async remove(item) {
    const { items } = this;
    if (!items)
      return;
    items.delete(item);
    if (items.size > 0)
      return;
    const dir = this.path;
    try {
      await promises.readdir(dir);
    } catch (err) {
      if (this._removeWatcher) {
        this._removeWatcher(sp__namespace.dirname(dir), sp__namespace.basename(dir));
      }
    }
  }
  has(item) {
    const { items } = this;
    if (!items)
      return;
    return items.has(item);
  }
  getChildren() {
    const { items } = this;
    if (!items)
      return [];
    return [...items.values()];
  }
  dispose() {
    this.items.clear();
    this.path = "";
    this._removeWatcher = EMPTY_FN;
    this.items = EMPTY_SET;
    Object.freeze(this);
  }
}
const STAT_METHOD_F = "stat";
const STAT_METHOD_L = "lstat";
class WatchHelper {
  fsw;
  path;
  watchPath;
  fullWatchPath;
  dirParts;
  followSymlinks;
  statMethod;
  constructor(path2, follow, fsw) {
    this.fsw = fsw;
    const watchPath = path2;
    this.path = path2 = path2.replace(REPLACER_RE, "");
    this.watchPath = watchPath;
    this.fullWatchPath = sp__namespace.resolve(watchPath);
    this.dirParts = [];
    this.dirParts.forEach((parts) => {
      if (parts.length > 1)
        parts.pop();
    });
    this.followSymlinks = follow;
    this.statMethod = follow ? STAT_METHOD_F : STAT_METHOD_L;
  }
  entryPath(entry) {
    return sp__namespace.join(this.watchPath, sp__namespace.relative(this.watchPath, entry.fullPath));
  }
  filterPath(entry) {
    const { stats } = entry;
    if (stats && stats.isSymbolicLink())
      return this.filterDir(entry);
    const resolvedPath = this.entryPath(entry);
    return this.fsw._isntIgnored(resolvedPath, stats) && this.fsw._hasReadPermissions(stats);
  }
  filterDir(entry) {
    return this.fsw._isntIgnored(this.entryPath(entry), entry.stats);
  }
}
class FSWatcher extends node_events.EventEmitter {
  closed;
  options;
  _closers;
  _ignoredPaths;
  _throttled;
  _streams;
  _symlinkPaths;
  _watched;
  _pendingWrites;
  _pendingUnlinks;
  _readyCount;
  _emitReady;
  _closePromise;
  _userIgnored;
  _readyEmitted;
  _emitRaw;
  _boundRemove;
  _nodeFsHandler;
  // Not indenting methods for history sake; for now.
  constructor(_opts = {}) {
    super();
    this.closed = false;
    this._closers = /* @__PURE__ */ new Map();
    this._ignoredPaths = /* @__PURE__ */ new Set();
    this._throttled = /* @__PURE__ */ new Map();
    this._streams = /* @__PURE__ */ new Set();
    this._symlinkPaths = /* @__PURE__ */ new Map();
    this._watched = /* @__PURE__ */ new Map();
    this._pendingWrites = /* @__PURE__ */ new Map();
    this._pendingUnlinks = /* @__PURE__ */ new Map();
    this._readyCount = 0;
    this._readyEmitted = false;
    const awf = _opts.awaitWriteFinish;
    const DEF_AWF = { stabilityThreshold: 2e3, pollInterval: 100 };
    const opts = {
      // Defaults
      persistent: true,
      ignoreInitial: false,
      ignorePermissionErrors: false,
      interval: 100,
      binaryInterval: 300,
      followSymlinks: true,
      usePolling: false,
      // useAsync: false,
      atomic: true,
      // NOTE: overwritten later (depends on usePolling)
      ..._opts,
      // Change format
      ignored: _opts.ignored ? arrify(_opts.ignored) : arrify([]),
      awaitWriteFinish: awf === true ? DEF_AWF : typeof awf === "object" ? { ...DEF_AWF, ...awf } : false
    };
    if (isIBMi)
      opts.usePolling = true;
    if (opts.atomic === void 0)
      opts.atomic = !opts.usePolling;
    const envPoll = process.env.CHOKIDAR_USEPOLLING;
    if (envPoll !== void 0) {
      const envLower = envPoll.toLowerCase();
      if (envLower === "false" || envLower === "0")
        opts.usePolling = false;
      else if (envLower === "true" || envLower === "1")
        opts.usePolling = true;
      else
        opts.usePolling = !!envLower;
    }
    const envInterval = process.env.CHOKIDAR_INTERVAL;
    if (envInterval)
      opts.interval = Number.parseInt(envInterval, 10);
    let readyCalls = 0;
    this._emitReady = () => {
      readyCalls++;
      if (readyCalls >= this._readyCount) {
        this._emitReady = EMPTY_FN;
        this._readyEmitted = true;
        process.nextTick(() => this.emit(EVENTS.READY));
      }
    };
    this._emitRaw = (...args) => this.emit(EVENTS.RAW, ...args);
    this._boundRemove = this._remove.bind(this);
    this.options = opts;
    this._nodeFsHandler = new NodeFsHandler(this);
    Object.freeze(opts);
  }
  _addIgnoredPath(matcher) {
    if (isMatcherObject(matcher)) {
      for (const ignored of this._ignoredPaths) {
        if (isMatcherObject(ignored) && ignored.path === matcher.path && ignored.recursive === matcher.recursive) {
          return;
        }
      }
    }
    this._ignoredPaths.add(matcher);
  }
  _removeIgnoredPath(matcher) {
    this._ignoredPaths.delete(matcher);
    if (typeof matcher === "string") {
      for (const ignored of this._ignoredPaths) {
        if (isMatcherObject(ignored) && ignored.path === matcher) {
          this._ignoredPaths.delete(ignored);
        }
      }
    }
  }
  // Public methods
  /**
   * Adds paths to be watched on an existing FSWatcher instance.
   * @param paths_ file or file list. Other arguments are unused
   */
  add(paths_, _origAdd, _internal) {
    const { cwd } = this.options;
    this.closed = false;
    this._closePromise = void 0;
    let paths = unifyPaths(paths_);
    if (cwd) {
      paths = paths.map((path2) => {
        const absPath = getAbsolutePath(path2, cwd);
        return absPath;
      });
    }
    paths.forEach((path2) => {
      this._removeIgnoredPath(path2);
    });
    this._userIgnored = void 0;
    if (!this._readyCount)
      this._readyCount = 0;
    this._readyCount += paths.length;
    Promise.all(paths.map(async (path2) => {
      const res = await this._nodeFsHandler._addToNodeFs(path2, !_internal, void 0, 0, _origAdd);
      if (res)
        this._emitReady();
      return res;
    })).then((results) => {
      if (this.closed)
        return;
      results.forEach((item) => {
        if (item)
          this.add(sp__namespace.dirname(item), sp__namespace.basename(_origAdd || item));
      });
    });
    return this;
  }
  /**
   * Close watchers or start ignoring events from specified paths.
   */
  unwatch(paths_) {
    if (this.closed)
      return this;
    const paths = unifyPaths(paths_);
    const { cwd } = this.options;
    paths.forEach((path2) => {
      if (!sp__namespace.isAbsolute(path2) && !this._closers.has(path2)) {
        if (cwd)
          path2 = sp__namespace.join(cwd, path2);
        path2 = sp__namespace.resolve(path2);
      }
      this._closePath(path2);
      this._addIgnoredPath(path2);
      if (this._watched.has(path2)) {
        this._addIgnoredPath({
          path: path2,
          recursive: true
        });
      }
      this._userIgnored = void 0;
    });
    return this;
  }
  /**
   * Close watchers and remove all listeners from watched paths.
   */
  close() {
    if (this._closePromise) {
      return this._closePromise;
    }
    this.closed = true;
    this.removeAllListeners();
    const closers = [];
    this._closers.forEach((closerList) => closerList.forEach((closer) => {
      const promise = closer();
      if (promise instanceof Promise)
        closers.push(promise);
    }));
    this._streams.forEach((stream) => stream.destroy());
    this._userIgnored = void 0;
    this._readyCount = 0;
    this._readyEmitted = false;
    this._watched.forEach((dirent) => dirent.dispose());
    this._closers.clear();
    this._watched.clear();
    this._streams.clear();
    this._symlinkPaths.clear();
    this._throttled.clear();
    this._closePromise = closers.length ? Promise.all(closers).then(() => void 0) : Promise.resolve();
    return this._closePromise;
  }
  /**
   * Expose list of watched paths
   * @returns for chaining
   */
  getWatched() {
    const watchList = {};
    this._watched.forEach((entry, dir) => {
      const key = this.options.cwd ? sp__namespace.relative(this.options.cwd, dir) : dir;
      const index = key || ONE_DOT;
      watchList[index] = entry.getChildren().sort();
    });
    return watchList;
  }
  emitWithAll(event, args) {
    this.emit(event, ...args);
    if (event !== EVENTS.ERROR)
      this.emit(EVENTS.ALL, event, ...args);
  }
  // Common helpers
  // --------------
  /**
   * Normalize and emit events.
   * Calling _emit DOES NOT MEAN emit() would be called!
   * @param event Type of event
   * @param path File or directory path
   * @param stats arguments to be passed with event
   * @returns the error if defined, otherwise the value of the FSWatcher instance's `closed` flag
   */
  async _emit(event, path2, stats) {
    if (this.closed)
      return;
    const opts = this.options;
    if (isWindows)
      path2 = sp__namespace.normalize(path2);
    if (opts.cwd)
      path2 = sp__namespace.relative(opts.cwd, path2);
    const args = [path2];
    if (stats != null)
      args.push(stats);
    const awf = opts.awaitWriteFinish;
    let pw;
    if (awf && (pw = this._pendingWrites.get(path2))) {
      pw.lastChange = /* @__PURE__ */ new Date();
      return this;
    }
    if (opts.atomic) {
      if (event === EVENTS.UNLINK) {
        this._pendingUnlinks.set(path2, [event, ...args]);
        setTimeout(() => {
          this._pendingUnlinks.forEach((entry, path22) => {
            this.emit(...entry);
            this.emit(EVENTS.ALL, ...entry);
            this._pendingUnlinks.delete(path22);
          });
        }, typeof opts.atomic === "number" ? opts.atomic : 100);
        return this;
      }
      if (event === EVENTS.ADD && this._pendingUnlinks.has(path2)) {
        event = EVENTS.CHANGE;
        this._pendingUnlinks.delete(path2);
      }
    }
    if (awf && (event === EVENTS.ADD || event === EVENTS.CHANGE) && this._readyEmitted) {
      const awfEmit = (err, stats2) => {
        if (err) {
          event = EVENTS.ERROR;
          args[0] = err;
          this.emitWithAll(event, args);
        } else if (stats2) {
          if (args.length > 1) {
            args[1] = stats2;
          } else {
            args.push(stats2);
          }
          this.emitWithAll(event, args);
        }
      };
      this._awaitWriteFinish(path2, awf.stabilityThreshold, event, awfEmit);
      return this;
    }
    if (event === EVENTS.CHANGE) {
      const isThrottled = !this._throttle(EVENTS.CHANGE, path2, 50);
      if (isThrottled)
        return this;
    }
    if (opts.alwaysStat && stats === void 0 && (event === EVENTS.ADD || event === EVENTS.ADD_DIR || event === EVENTS.CHANGE)) {
      const fullPath = opts.cwd ? sp__namespace.join(opts.cwd, path2) : path2;
      let stats2;
      try {
        stats2 = await promises.stat(fullPath);
      } catch (err) {
      }
      if (!stats2 || this.closed)
        return;
      args.push(stats2);
    }
    this.emitWithAll(event, args);
    return this;
  }
  /**
   * Common handler for errors
   * @returns The error if defined, otherwise the value of the FSWatcher instance's `closed` flag
   */
  _handleError(error) {
    const code = error && error.code;
    if (error && code !== "ENOENT" && code !== "ENOTDIR" && (!this.options.ignorePermissionErrors || code !== "EPERM" && code !== "EACCES")) {
      this.emit(EVENTS.ERROR, error);
    }
    return error || this.closed;
  }
  /**
   * Helper utility for throttling
   * @param actionType type being throttled
   * @param path being acted upon
   * @param timeout duration of time to suppress duplicate actions
   * @returns tracking object or false if action should be suppressed
   */
  _throttle(actionType, path2, timeout) {
    if (!this._throttled.has(actionType)) {
      this._throttled.set(actionType, /* @__PURE__ */ new Map());
    }
    const action = this._throttled.get(actionType);
    if (!action)
      throw new Error("invalid throttle");
    const actionPath = action.get(path2);
    if (actionPath) {
      actionPath.count++;
      return false;
    }
    let timeoutObject;
    const clear = () => {
      const item = action.get(path2);
      const count = item ? item.count : 0;
      action.delete(path2);
      clearTimeout(timeoutObject);
      if (item)
        clearTimeout(item.timeoutObject);
      return count;
    };
    timeoutObject = setTimeout(clear, timeout);
    const thr = { timeoutObject, clear, count: 0 };
    action.set(path2, thr);
    return thr;
  }
  _incrReadyCount() {
    return this._readyCount++;
  }
  /**
   * Awaits write operation to finish.
   * Polls a newly created file for size variations. When files size does not change for 'threshold' milliseconds calls callback.
   * @param path being acted upon
   * @param threshold Time in milliseconds a file size must be fixed before acknowledging write OP is finished
   * @param event
   * @param awfEmit Callback to be called when ready for event to be emitted.
   */
  _awaitWriteFinish(path2, threshold, event, awfEmit) {
    const awf = this.options.awaitWriteFinish;
    if (typeof awf !== "object")
      return;
    const pollInterval = awf.pollInterval;
    let timeoutHandler;
    let fullPath = path2;
    if (this.options.cwd && !sp__namespace.isAbsolute(path2)) {
      fullPath = sp__namespace.join(this.options.cwd, path2);
    }
    const now = /* @__PURE__ */ new Date();
    const writes = this._pendingWrites;
    function awaitWriteFinishFn(prevStat) {
      node_fs.stat(fullPath, (err, curStat) => {
        if (err || !writes.has(path2)) {
          if (err && err.code !== "ENOENT")
            awfEmit(err);
          return;
        }
        const now2 = Number(/* @__PURE__ */ new Date());
        if (prevStat && curStat.size !== prevStat.size) {
          writes.get(path2).lastChange = now2;
        }
        const pw = writes.get(path2);
        const df = now2 - pw.lastChange;
        if (df >= threshold) {
          writes.delete(path2);
          awfEmit(void 0, curStat);
        } else {
          timeoutHandler = setTimeout(awaitWriteFinishFn, pollInterval, curStat);
        }
      });
    }
    if (!writes.has(path2)) {
      writes.set(path2, {
        lastChange: now,
        cancelWait: () => {
          writes.delete(path2);
          clearTimeout(timeoutHandler);
          return event;
        }
      });
      timeoutHandler = setTimeout(awaitWriteFinishFn, pollInterval);
    }
  }
  /**
   * Determines whether user has asked to ignore this path.
   */
  _isIgnored(path2, stats) {
    if (this.options.atomic && DOT_RE.test(path2))
      return true;
    if (!this._userIgnored) {
      const { cwd } = this.options;
      const ign = this.options.ignored;
      const ignored = (ign || []).map(normalizeIgnored(cwd));
      const ignoredPaths = [...this._ignoredPaths];
      const list = [...ignoredPaths.map(normalizeIgnored(cwd)), ...ignored];
      this._userIgnored = anymatch(list);
    }
    return this._userIgnored(path2, stats);
  }
  _isntIgnored(path2, stat2) {
    return !this._isIgnored(path2, stat2);
  }
  /**
   * Provides a set of common helpers and properties relating to symlink handling.
   * @param path file or directory pattern being watched
   */
  _getWatchHelpers(path2) {
    return new WatchHelper(path2, this.options.followSymlinks, this);
  }
  // Directory helpers
  // -----------------
  /**
   * Provides directory tracking objects
   * @param directory path of the directory
   */
  _getWatchedDir(directory) {
    const dir = sp__namespace.resolve(directory);
    if (!this._watched.has(dir))
      this._watched.set(dir, new DirEntry(dir, this._boundRemove));
    return this._watched.get(dir);
  }
  // File helpers
  // ------------
  /**
   * Check for read permissions: https://stackoverflow.com/a/11781404/1358405
   */
  _hasReadPermissions(stats) {
    if (this.options.ignorePermissionErrors)
      return true;
    return Boolean(Number(stats.mode) & 256);
  }
  /**
   * Handles emitting unlink events for
   * files and directories, and via recursion, for
   * files and directories within directories that are unlinked
   * @param directory within which the following item is located
   * @param item      base path of item/directory
   */
  _remove(directory, item, isDirectory2) {
    const path2 = sp__namespace.join(directory, item);
    const fullPath = sp__namespace.resolve(path2);
    isDirectory2 = isDirectory2 != null ? isDirectory2 : this._watched.has(path2) || this._watched.has(fullPath);
    if (!this._throttle("remove", path2, 100))
      return;
    if (!isDirectory2 && this._watched.size === 1) {
      this.add(directory, item, true);
    }
    const wp = this._getWatchedDir(path2);
    const nestedDirectoryChildren = wp.getChildren();
    nestedDirectoryChildren.forEach((nested) => this._remove(path2, nested));
    const parent = this._getWatchedDir(directory);
    const wasTracked = parent.has(item);
    parent.remove(item);
    if (this._symlinkPaths.has(fullPath)) {
      this._symlinkPaths.delete(fullPath);
    }
    let relPath = path2;
    if (this.options.cwd)
      relPath = sp__namespace.relative(this.options.cwd, path2);
    if (this.options.awaitWriteFinish && this._pendingWrites.has(relPath)) {
      const event = this._pendingWrites.get(relPath).cancelWait();
      if (event === EVENTS.ADD)
        return;
    }
    this._watched.delete(path2);
    this._watched.delete(fullPath);
    const eventName = isDirectory2 ? EVENTS.UNLINK_DIR : EVENTS.UNLINK;
    if (wasTracked && !this._isIgnored(path2))
      this._emit(eventName, path2);
    this._closePath(path2);
  }
  /**
   * Closes all watchers for a path
   */
  _closePath(path2) {
    this._closeFile(path2);
    const dir = sp__namespace.dirname(path2);
    this._getWatchedDir(dir).remove(sp__namespace.basename(path2));
  }
  /**
   * Closes only file-specific watchers
   */
  _closeFile(path2) {
    const closers = this._closers.get(path2);
    if (!closers)
      return;
    closers.forEach((closer) => closer());
    this._closers.delete(path2);
  }
  _addPathCloser(path2, closer) {
    if (!closer)
      return;
    let list = this._closers.get(path2);
    if (!list) {
      list = [];
      this._closers.set(path2, list);
    }
    list.push(closer);
  }
  _readdirp(root, opts) {
    if (this.closed)
      return;
    const options = { type: EVENTS.ALL, alwaysStat: true, lstat: true, ...opts, depth: 0 };
    let stream = readdirp(root, options);
    this._streams.add(stream);
    stream.once(STR_CLOSE, () => {
      stream = void 0;
    });
    stream.once(STR_END, () => {
      if (stream) {
        this._streams.delete(stream);
        stream = void 0;
      }
    });
    return stream;
  }
}
function watch(paths, options = {}) {
  const watcher = new FSWatcher(options);
  watcher.add(paths);
  return watcher;
}
const chokidar = { watch, FSWatcher };
function getConfigPath() {
  return path.join(electron.app.getPath("userData"), "config.json");
}
function readConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return {};
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function writeConfig(config) {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}
function loadWorkspacePath() {
  const config = readConfig();
  return config.workspacePath ?? null;
}
function saveWorkspacePath(p) {
  const config = readConfig();
  writeConfig({ ...config, workspacePath: p });
}
const WORKSPACE_SUBFOLDERS = ["_Inbox", "_Templates", "_Reference", "_Shared"];
function createFolderStructure(root) {
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
  for (const sub of WORKSPACE_SUBFOLDERS) {
    const subPath = path.join(root, sub);
    if (!fs.existsSync(subPath)) {
      fs.mkdirSync(subPath, { recursive: true });
    }
  }
}
function getDefaultWorkspacePath() {
  return path.join(electron.app.getPath("documents"), "Psygil Cases");
}
let activeWatcher = null;
function watchWorkspace(root) {
  if (activeWatcher !== null) {
    activeWatcher.close();
    activeWatcher = null;
  }
  const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    persistent: true,
    depth: 10,
    ignored: [
      /(^|[/\\])\../,
      // dotfiles
      "**/node_modules/**",
      "**/.DS_Store"
    ]
  });
  const broadcast = (event, filePath) => {
    const windows = electron.BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send("workspace:file-changed", { event, path: filePath });
      }
    }
  };
  watcher.on("add", (filePath) => broadcast("add", filePath));
  watcher.on("change", (filePath) => broadcast("change", filePath));
  watcher.on("unlink", (filePath) => broadcast("unlink", filePath));
  watcher.on("addDir", (dirPath) => broadcast("addDir", dirPath));
  watcher.on("unlinkDir", (dirPath) => broadcast("unlinkDir", dirPath));
  activeWatcher = watcher;
}
function stopWatcher() {
  if (activeWatcher !== null) {
    activeWatcher.close();
    activeWatcher = null;
  }
}
function getWorkspaceTree(root) {
  if (!fs.existsSync(root)) return [];
  return buildTree(root);
}
function buildTree(dirPath) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath);
  } catch {
    return [];
  }
  const nodes = [];
  const sorted = [...entries].sort((a, b) => {
    const aIsDir = isDirectory(path.join(dirPath, a));
    const bIsDir = isDirectory(path.join(dirPath, b));
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return a.localeCompare(b);
  });
  for (const name of sorted) {
    if (name.startsWith(".")) continue;
    const fullPath = path.join(dirPath, name);
    const isDir = isDirectory(fullPath);
    const node = {
      name,
      path: fullPath,
      isDirectory: isDir,
      children: isDir ? buildTree(fullPath) : void 0
    };
    nodes.push(node);
  }
  return nodes;
}
function isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
const SOCKET_PATH = "/tmp/psygil-sidecar.sock";
const REQUEST_TIMEOUT_MS = 3e4;
let _rpcId = 0;
function rpcCall(method, params) {
  return new Promise((resolve, reject) => {
    const client = new net__namespace.Socket();
    const id = ++_rpcId;
    const timeout = setTimeout(() => {
      client.destroy();
      reject(new Error(`PII sidecar request timed out: ${method}`));
    }, REQUEST_TIMEOUT_MS);
    client.connect(SOCKET_PATH, () => {
      const request = JSON.stringify({ jsonrpc: "2.0", method, params, id });
      client.write(request + "\n");
    });
    let buffer = "";
    client.on("data", (chunk) => {
      buffer += chunk.toString();
      if (buffer.includes("\n")) {
        clearTimeout(timeout);
        try {
          const resp = JSON.parse(buffer.split("\n")[0]);
          client.destroy();
          if (resp.error) {
            reject(new Error(`PII sidecar error: ${resp.error.message}`));
          } else {
            resolve(resp.result ?? {});
          }
        } catch {
          client.destroy();
          reject(new Error(`Failed to parse sidecar response: ${buffer}`));
        }
      }
    });
    client.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`PII sidecar connection error: ${err.message}`));
    });
  });
}
async function detect(text) {
  const result = await rpcCall("pii/detect", { text });
  const entities = result.entities;
  return entities.map((e) => ({
    text: e.text,
    start: e.start,
    end: e.end,
    type: e.type,
    score: e.score
  }));
}
async function batchDetect(texts) {
  const result = await rpcCall("pii/batch", { texts: [...texts] });
  const results = result.results;
  return results.map(
    (entities) => entities.map((e) => ({
      text: e.text,
      start: e.start,
      end: e.end,
      type: e.type,
      score: e.score
    }))
  );
}
function ok(data) {
  return { status: "success", data };
}
function fail(error_code, message) {
  return { status: "error", error_code, message };
}
function registerCasesHandlers() {
  electron.ipcMain.handle(
    "cases:list",
    (_event, _params) => ok({ cases: [], total: 0, page: 1, limit: 20 })
  );
  electron.ipcMain.handle(
    "cases:get",
    (_event, _params) => ok({
      case_id: "",
      case_name: "",
      case_type: "",
      status: "",
      pipeline_stage: "onboarding",
      created_at: "",
      last_modified: "",
      document_count: 0,
      metadata: {}
    })
  );
  electron.ipcMain.handle(
    "cases:create",
    (_event, _params) => ok({ case_id: "stub-id", created_at: (/* @__PURE__ */ new Date()).toISOString() })
  );
  electron.ipcMain.handle(
    "cases:update",
    (_event, _params) => ok({ case_id: "", updated_fields: [] })
  );
  electron.ipcMain.handle(
    "cases:archive",
    (_event, _params) => ok({ case_id: "", archived_at: (/* @__PURE__ */ new Date()).toISOString() })
  );
}
function registerDbHandlers() {
  electron.ipcMain.handle(
    "db:health",
    () => ok({ connected: true, encrypted: true, version: "0.1.0" })
  );
}
function registerAuthHandlers() {
  electron.ipcMain.handle(
    "auth:login",
    async (event) => {
      try {
        const parentWindow = electron.BrowserWindow.fromWebContents(event.sender);
        const result = await performLogin(parentWindow);
        if (!result.success) {
          return fail("LOGIN_FAILED", result.error ?? "Login failed");
        }
        const license = checkLicense();
        return ok({
          is_authenticated: true,
          user_id: result.userId ?? "",
          user_name: result.userName ?? "",
          user_email: result.email ?? "",
          is_active: license.is_active
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Login failed";
        return fail("LOGIN_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "auth:getStatus",
    () => ok(getAuthStatus())
  );
  electron.ipcMain.handle(
    "auth:logout",
    (event) => {
      try {
        const parentWindow = electron.BrowserWindow.fromWebContents(event.sender);
        const result = performLogout(parentWindow);
        return ok(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Logout failed";
        return fail("LOGOUT_FAILED", message);
      }
    }
  );
}
function registerConfigHandlers() {
  electron.ipcMain.handle(
    "config:get",
    (_event, _params) => ok({ config: {} })
  );
  electron.ipcMain.handle(
    "config:set",
    (_event, _params) => ok({ updated_config: {} })
  );
}
function registerWorkspaceHandlers() {
  electron.ipcMain.handle(
    "workspace:getPath",
    () => ok(loadWorkspacePath())
  );
  electron.ipcMain.handle(
    "workspace:setPath",
    (_event, path2) => {
      try {
        saveWorkspacePath(path2);
        createFolderStructure(path2);
        watchWorkspace(path2);
        return ok(void 0);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to set workspace path";
        return fail("WORKSPACE_SET_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "workspace:getTree",
    () => {
      const wsPath = loadWorkspacePath();
      if (wsPath === null) {
        return fail("NO_WORKSPACE", "No workspace path configured");
      }
      try {
        return ok(getWorkspaceTree(wsPath));
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to read workspace tree";
        return fail("TREE_READ_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "workspace:openInFinder",
    (_event, path2) => {
      electron.shell.openPath(path2);
      return ok(void 0);
    }
  );
  electron.ipcMain.handle(
    "workspace:pickFolder",
    async (event) => {
      const parentWindow = electron.BrowserWindow.fromWebContents(event.sender);
      const result = await electron.dialog.showOpenDialog(parentWindow, {
        title: "Choose Workspace Folder",
        properties: ["openDirectory", "createDirectory"],
        buttonLabel: "Choose"
      });
      if (result.canceled || result.filePaths.length === 0) {
        return ok(null);
      }
      return ok(result.filePaths[0]);
    }
  );
  electron.ipcMain.handle(
    "workspace:getDefaultPath",
    () => ok(getDefaultWorkspacePath())
  );
}
function registerPiiHandlers() {
  electron.ipcMain.handle(
    "pii:detect",
    async (_event, params) => {
      try {
        const entities = await detect(params.text);
        return ok({ entities });
      } catch (e) {
        const message = e instanceof Error ? e.message : "PII detection failed";
        return fail("PII_DETECT_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "pii:batchDetect",
    async (_event, params) => {
      try {
        const results = await batchDetect(params.texts);
        return ok({ results });
      } catch (e) {
        const message = e instanceof Error ? e.message : "PII batch detection failed";
        return fail("PII_BATCH_DETECT_FAILED", message);
      }
    }
  );
}
function registerAllHandlers() {
  registerCasesHandlers();
  registerDbHandlers();
  registerAuthHandlers();
  registerConfigHandlers();
  registerPiiHandlers();
  registerWorkspaceHandlers();
}
electron.protocol.registerSchemesAsPrivileged([
  {
    scheme: "psygil",
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: false,
      supportFetchAPI: false,
      corsEnabled: false
    }
  }
]);
function createWindow() {
  const win = new electron.BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  if (process.env.NODE_ENV === "development") {
    win.webContents.openDevTools();
  }
  if (process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  return win;
}
electron.app.whenReady().then(() => {
  electron.app.setAsDefaultProtocolClient("psygil");
  registerAllHandlers();
  const wsPath = loadWorkspacePath();
  if (wsPath !== null) {
    watchWorkspace(wsPath);
  }
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    stopWatcher();
    electron.app.quit();
  }
});
electron.app.on("before-quit", () => {
  stopWatcher();
});
