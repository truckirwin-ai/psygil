"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const crypto = require("crypto");
const fs = require("fs");
const ED25519_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAPLACE_HOLDER_KEY_REPLACE_DURING_CI_BUILD_0000000=
-----END PUBLIC KEY-----`;
const UPDATE_SERVER_URL = process.env.PSYGIL_UPDATE_URL || "https://updates.psygil.com";
const CHECK_DELAY_MS = 3e4;
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1e3;
let checkTimer = null;
function verifySignature(hash, signature) {
  try {
    const isValid = crypto.createVerify("ed25519").update(hash).verify(ED25519_PUBLIC_KEY, Buffer.from(signature, "base64"));
    return isValid;
  } catch (err) {
    console.error("[updater] Signature verification failed:", err.message);
    return false;
  }
}
function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}
async function checkForUpdates() {
  try {
    const platform = process.platform === "darwin" ? "mac" : process.platform === "win32" ? "win" : "linux";
    const arch = process.arch;
    const res = await fetch(`${UPDATE_SERVER_URL}/latest.json`, {
      headers: { "User-Agent": `Psygil/${getAppVersion()}` },
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) {
      console.log("[updater] No update available (HTTP", res.status, ")");
      return { available: false };
    }
    const manifest = await res.json();
    const currentVersion = getAppVersion();
    if (manifest.version === currentVersion) {
      return { available: false };
    }
    const platformKey = `${platform}-${arch}`;
    const platformInfo = manifest.platforms[platformKey] ?? manifest.platforms[platform];
    if (!platformInfo) {
      console.log(`[updater] No update for platform ${platformKey}`);
      return { available: false };
    }
    if (!verifySignature(platformInfo.sha256, platformInfo.signature)) {
      console.error("[updater] SECURITY: Update signature verification FAILED — rejecting update");
      return { available: false };
    }
    console.log(`[updater] Update available: ${currentVersion} → ${manifest.version}`);
    return {
      available: true,
      version: manifest.version,
      releaseNotes: manifest.releaseNotes
    };
  } catch (err) {
    console.error("[updater] Check failed:", err.message);
    return { available: false };
  }
}
async function downloadUpdate(version) {
  try {
    const platform = process.platform === "darwin" ? "mac" : process.platform === "win32" ? "win" : "linux";
    const res = await fetch(`${UPDATE_SERVER_URL}/latest.json`, {
      signal: AbortSignal.timeout(1e4)
    });
    const manifest = await res.json();
    const platformKey = `${platform}-${process.arch}`;
    const platformInfo = manifest.platforms[platformKey] ?? manifest.platforms[platform];
    if (!platformInfo) return null;
    const { app } = await import("electron");
    const downloadPath = require("path").join(app.getPath("temp"), `psygil-update-${version}`);
    const dlRes = await fetch(platformInfo.url, {
      signal: AbortSignal.timeout(5 * 60 * 1e3)
      // 5 min timeout
    });
    if (!dlRes.ok) return null;
    const buffer = Buffer.from(await dlRes.arrayBuffer());
    const { writeFileSync } = await import("fs");
    writeFileSync(downloadPath, buffer);
    const computedHash = hashFile(downloadPath);
    if (computedHash !== platformInfo.sha256) {
      console.error("[updater] SECURITY: Download hash mismatch — rejecting");
      const { unlinkSync } = await import("fs");
      unlinkSync(downloadPath);
      return null;
    }
    if (!verifySignature(computedHash, platformInfo.signature)) {
      console.error("[updater] SECURITY: Download signature verification FAILED — rejecting");
      const { unlinkSync } = await import("fs");
      unlinkSync(downloadPath);
      return null;
    }
    console.log("[updater] Download verified:", downloadPath);
    return downloadPath;
  } catch (err) {
    console.error("[updater] Download failed:", err.message);
    return null;
  }
}
function startUpdateChecker() {
  setTimeout(() => {
    void checkForUpdates();
  }, CHECK_DELAY_MS);
  checkTimer = setInterval(() => {
    void checkForUpdates();
  }, CHECK_INTERVAL_MS);
}
function stopUpdateChecker() {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
}
function getAppVersion() {
  try {
    return require("../../package.json").version;
  } catch {
    return "0.0.0";
  }
}
exports.checkForUpdates = checkForUpdates;
exports.downloadUpdate = downloadUpdate;
exports.getAppVersion = getAppVersion;
exports.startUpdateChecker = startUpdateChecker;
exports.stopUpdateChecker = stopUpdateChecker;
