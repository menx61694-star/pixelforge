(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.PixelForgeVaultStorage = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function parseSize(value) {
    if (value === null || value === undefined || value === "") return null;
    const size = Number(value);
    return Number.isFinite(size) && size >= 0 ? size : null;
  }

  function isFileEntry(item) {
    return Boolean(
      item &&
      typeof item.name === "string" &&
      item.name.length > 0 &&
      item.id !== null &&
      item.id !== undefined
    );
  }

  function getFileSizeBytes(file) {
    const metadata = file && file.metadata;
    if (!metadata || typeof metadata !== "object") return null;
    const size = parseSize(metadata.size);
    return size !== null ? size : parseSize(metadata.contentLength);
  }

  function calculateUsage(files) {
    const entries = Array.isArray(files) ? files.filter(isFileEntry) : [];
    let totalBytes = 0;
    let unknownSizeCount = 0;

    entries.forEach((file) => {
      const size = getFileSizeBytes(file);
      if (size === null) unknownSizeCount += 1;
      else totalBytes += size;
    });

    return {
      fileCount: entries.length,
      totalBytes,
      unknownSizeCount,
    };
  }

  function formatBytes(value) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "Unavailable";
    if (value < 1024) return Math.round(value) + " B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    return (value / Math.pow(1024, exponent)).toFixed(2) + " " + units[exponent];
  }

  return Object.freeze({
    isFileEntry,
    getFileSizeBytes,
    calculateUsage,
    formatBytes,
  });
});
