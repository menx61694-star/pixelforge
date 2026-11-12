const test = require("node:test");
const assert = require("node:assert/strict");
const vaultStorage = require("../vault-storage-utils.js");

test("file detection excludes Supabase folder entries", () => {
  assert.equal(vaultStorage.isFileEntry({ id: "file-1", name: "notes.pdf", metadata: { size: 20 } }), true);
  assert.equal(vaultStorage.isFileEntry({ id: null, name: "folder", metadata: null }), false);
  assert.equal(vaultStorage.isFileEntry({ name: "unknown-entry" }), false);
});

test("file size reads metadata.size and falls back to contentLength", () => {
  assert.equal(vaultStorage.getFileSizeBytes({ metadata: { size: 2048 } }), 2048);
  assert.equal(vaultStorage.getFileSizeBytes({ metadata: { size: "512" } }), 512);
  assert.equal(vaultStorage.getFileSizeBytes({ metadata: { size: null, contentLength: "4096" } }), 4096);
  assert.equal(vaultStorage.getFileSizeBytes({ metadata: { size: 0 } }), 0);
});

test("missing or invalid metadata is unknown, not silently counted as zero bytes", () => {
  assert.equal(vaultStorage.getFileSizeBytes({ metadata: null }), null);
  assert.equal(vaultStorage.getFileSizeBytes({ metadata: {} }), null);
  assert.equal(vaultStorage.getFileSizeBytes({ metadata: { size: "" } }), null);
  assert.equal(vaultStorage.getFileSizeBytes({ metadata: { size: -1 } }), null);
  assert.equal(vaultStorage.getFileSizeBytes({ metadata: { size: "invalid" } }), null);
});

test("usage sums every file and reports files with unknown size", () => {
  const usage = vaultStorage.calculateUsage([
    { id: "one", name: "one.pdf", metadata: { size: 1024 } },
    { id: "two", name: "two.jpg", metadata: { size: null, contentLength: 512 } },
    { id: "three", name: "three.png", metadata: null },
    { id: null, name: "folder", metadata: null },
  ]);

  assert.deepEqual(usage, {
    fileCount: 3,
    totalBytes: 1536,
    unknownSizeCount: 1,
  });
});

test("byte formatting preserves sub-kilobyte sizes and handles larger units", () => {
  assert.equal(vaultStorage.formatBytes(0), "0 B");
  assert.equal(vaultStorage.formatBytes(512), "512 B");
  assert.equal(vaultStorage.formatBytes(1024), "1.00 KB");
  assert.equal(vaultStorage.formatBytes(1048576), "1.00 MB");
  assert.equal(vaultStorage.formatBytes(-1), "Unavailable");
});
