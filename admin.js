(() => {
 
const firebaseConfig = {
  apiKey: "AIzaSyCkQReOUqbwBRDPCxg2wUcbZp3sL3Y-1B4",
  authDomain: "pixelforge-66f0c.firebaseapp.com",
  databaseURL: "https://pixelforge-66f0c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pixelforge-66f0c",
  storageBucket: "pixelforge-66f0c.firebasestorage.app",
  messagingSenderId: "133621997508",
  appId: "1:133621997508:web:2d92b52b7ff46b4552ce91",
  measurementId: "G-C22G53L12V"
};

  const ADMIN_UID = "5PcOkyDEcNc1puSeB2lQ6dLFVOF2";
  const SUPABASE_URL = "https://zeueivmdzhkhonkyllij.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_sTs9Niej0BbWOw1vITV_jA_utoWwsw3";
  const BUCKET = "private-documents";
  const PUBLIC_BUCKET = "public-documents";
  const PUBLIC_CATEGORIES = ["pdf-documents", "study-notes", "books-resources", "other-documents", "exam-materials", "technology-guides"];
  const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
  const vaultStorage = window.PixelForgeVaultStorage;

  const loginView = document.getElementById("login-view");
  const form = document.getElementById("login-form");
  const loginButton = document.getElementById("login-button");
  const logoutButton = document.getElementById("logout-button");
  const status = document.getElementById("status");
  const sessionPanel = document.getElementById("admin-session");
  const uploadForm = document.getElementById("upload-form");
  const uploadButton = document.getElementById("upload-button");
  const fileInput = document.getElementById("document-file");
  const vaultStatus = document.getElementById("vault-status");
  const fileList = document.getElementById("file-list");
  const refreshButton = document.getElementById("refresh-files");
  const fileSearch = document.getElementById("file-search");
  const selectedFile = document.getElementById("selected-file");
  const countStat = document.getElementById("stat-doc-count");
  const storageStat = document.getElementById("stat-storage");
  const driveCountStat = document.getElementById("stat-drive-count");
  const driveCountNote = document.getElementById("stat-drive-count-note");
  const driveStatusStat = document.getElementById("stat-drive-status");
  const driveStatusNote = document.getElementById("stat-drive-status-note");
  const publishedCountStat = document.getElementById("stat-published-count");
  const userCountStat = document.getElementById("stat-user-count");
  const overviewPageViewsStat = document.getElementById("stat-overview-page-views");
  const overviewPageViewsNote = document.getElementById("stat-overview-page-views-note");
  const overviewActivityList = document.getElementById("overview-activity-list");
  const overviewActivityStatus = document.getElementById("overview-activity-status");
  const activityList = document.getElementById("activity-list");
  const activityStatus = document.getElementById("activity-status");
  const countLabel = document.getElementById("file-count-label");
  const googleDriveButton = document.getElementById("google-drive-connect");
  const googleDriveStatus = document.getElementById("google-drive-status");
  const googleDriveFileInput = document.getElementById("google-drive-file");
  const googleDriveUploadButton = document.getElementById("google-drive-upload");
  const googleDriveRefreshButton = document.getElementById("google-drive-refresh");
  const googleDriveFilesStatus = document.getElementById("google-drive-files-status");
  const googleDriveFileList = document.getElementById("google-drive-file-list");
  let googleDriveConnected = false;
  let currentFiles = [];
  let currentDriveFiles = [];
  let driveFilesLoaded = false;
  let currentUserUid = null;
  let currentUserRole = null;
  let currentPermissions = new Set();
  const usersNavLink = document.getElementById("users-nav-link");
  const settingsNavLink = document.getElementById("settings-nav-link");
  const settingsStatus = document.getElementById("settings-status");
  const settingsAuditStatus = document.getElementById("settings-audit-status");
  const settingsAuditBody = document.getElementById("settings-audit-body");
  const refreshSettingsButton = document.getElementById("refresh-settings");
  const analyticsNavLink = document.getElementById("analytics-nav-link");
  const securityLogsNavLink = document.getElementById("security-logs-nav-link");
  const securityLogsBody = document.getElementById("security-logs-body");
  const securityLogsStatus = document.getElementById("security-logs-status");
  const refreshSecurityLogsButton = document.getElementById("refresh-security-logs");
  const deleteSecurityLogsButton = document.getElementById("delete-security-logs");
  const analyticsRange = document.getElementById("analytics-range");
  let analyticsLoadSequence = 0;
  const googleDriveNavLink = document.getElementById("google-drive-nav-link");
  const userCreateForm = document.getElementById("user-create-form");
  const usersStatus = document.getElementById("users-status");
  const usersTableBody = document.getElementById("users-table-body");
  const permissionsTableBody = document.getElementById("permissions-table-body");
  const newUserEmail = document.getElementById("new-user-email");
  const newUserRole = document.getElementById("new-user-role");
  const createUserButton = document.getElementById("create-user-button");

  const sidebarLinks = Array.from(document.querySelectorAll(".sidebar .nav-link"));
  const dashboardPages = ["overview", "recent-activity", "documents", "google-drive", "analytics", "security-logs", "users", "settings"]
    .map(id => document.getElementById(id))
    .filter(Boolean);
  function syncSidebarNavigation() {
    const requestedPage = (window.location.hash || "#overview").slice(1);
    let activePage = dashboardPages.some(page => page.id === requestedPage) ? requestedPage : "overview";
    const pagePermissions = { overview: "dashboard.view", "recent-activity": "activity.view", documents: "vault.read", "google-drive": "drive.read", analytics: "analytics.view", "security-logs": "security.logs.view", users: "users.manage", settings: "settings.view" };
    if (currentUserUid && !currentPermissions.has(pagePermissions[activePage])) activePage = "overview";
    dashboardPages.forEach(page => { page.hidden = page.id !== activePage; });
    if (activePage === "analytics" && currentPermissions.has("analytics.view")) loadAnalyticsDashboard();
    if (activePage === "security-logs" && currentPermissions.has("security.logs.view")) loadSecurityLogs();
    if (activePage === "settings" && currentPermissions.has("settings.view")) loadSettings();
    sidebarLinks.forEach(link => {
      const isActive = link.getAttribute("href") === "#" + activePage;
      link.classList.toggle("active", isActive);
      if (isActive) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }
  window.addEventListener("hashchange", syncSidebarNavigation);
  syncSidebarNavigation();

  if (!window.firebase || !form || !loginButton || !logoutButton || !status || !sessionPanel) {
    if (status) status.textContent = "The sign-in service could not be loaded. Refresh and try again.";
    return;
  }

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  let supabaseClient = null;
  if (window.supabase && typeof window.supabase.createClient === "function") {
    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        accessToken: async () => {
          const currentUser = auth.currentUser;
          return currentUser ? currentUser.getIdToken() : null;
        }
      }
    );
    window.pixelForgeSupabase = supabaseClient;
  }

  function setGoogleDriveStatus(message, isError = false) {
    if (!googleDriveStatus) return;
    googleDriveStatus.textContent = message;
    googleDriveStatus.style.color = isError ? "#a23c32" : "#53617b";
  }

  async function connectGoogleDrive() {
    if (!auth.currentUser || auth.currentUser.uid !== ADMIN_UID || currentUserRole !== "admin") {
      setGoogleDriveStatus("Owner administrator access is required to connect Google Drive.", true);
      return;
    }
    if (!googleDriveButton) return;
    googleDriveButton.disabled = true;
    setGoogleDriveStatus("Preparing secure Google Drive connection…");
    try {
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch(SUPABASE_URL + "/functions/v1/google-drive-oauth?action=start", {
        method: "POST",
        headers: { "Authorization": "Bearer " + idToken, "Content-Type": "application/json" }
      });
      const payload = await response.json();
      if (!response.ok || !payload.authorization_url) throw new Error(payload.error || "Could not start Google authorization.");
      window.location.assign(payload.authorization_url);
    } catch (error) {
      setGoogleDriveStatus("Google Drive connection could not start: " + (error.message || "Unknown error"), true);
      googleDriveButton.disabled = false;
    }
  }

  async function googleDriveRequest(action, options = {}) {
    const user = auth.currentUser;
    if (!user || !currentPermissions.has("drive.read")) throw new Error("Drive access is not permitted for this account.");
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", "Bearer " + await user.getIdToken());
    const endpoint = new URL(SUPABASE_URL + "/functions/v1/google-drive-files");
    endpoint.searchParams.set("action", action);
    if (options.query) {
      Object.entries(options.query).forEach(([key, value]) => endpoint.searchParams.set(key, String(value)));
    }
    const response = await fetch(endpoint.toString(), {
      method: options.method || "GET",
      headers,
      body: options.body
    });
    return response;
  }

  function setDriveFilesStatus(message, isError = false) {
    if (!googleDriveFilesStatus) return;
    googleDriveFilesStatus.textContent = message;
    googleDriveFilesStatus.style.color = isError ? "#a23c32" : "#53617b";
  }

  async function refreshGoogleDriveStatus() {
    try {
      const response = await googleDriveRequest("status");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not check Google Drive status.");
      googleDriveConnected = payload.connected === true;
      updateDriveOverview();
      if (googleDriveUploadButton) googleDriveUploadButton.disabled = !googleDriveConnected;
      if (googleDriveRefreshButton) googleDriveRefreshButton.disabled = !googleDriveConnected;
      if (googleDriveConnected) {
        setGoogleDriveStatus("Google Drive is connected.");
        await loadGoogleDriveFiles();
      } else {
        currentDriveFiles = [];
        driveFilesLoaded = false;
        updateDriveOverview();
        updateDashboardActivity();
        setGoogleDriveStatus("Google Drive is not connected.");
        setDriveFilesStatus("Connect Google Drive to list or upload files.");
      }
    } catch (error) {
      if (driveStatusStat) driveStatusStat.textContent = "Unknown";
      if (driveStatusNote) driveStatusNote.textContent = "Status check failed";
      setDriveFilesStatus(error.message || "Google Drive status check failed.", true);
    }
  }

  async function loadGoogleDriveFiles() {
    if (!googleDriveConnected || !googleDriveFileList) return;
    if (googleDriveRefreshButton) googleDriveRefreshButton.disabled = true;
    setDriveFilesStatus("Loading Google Drive files…");
    try {
      const response = await googleDriveRequest("list");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not list Google Drive files.");
      googleDriveFileList.replaceChildren();
      const files = Array.isArray(payload.files) ? payload.files : [];
      currentDriveFiles = files;
      driveFilesLoaded = true;
      updateDriveOverview();
      updateDashboardActivity();
      if (!files.length) {
        const empty = document.createElement("li");
        empty.className = "empty-state";
        empty.textContent = "No files found in the connected Drive app space.";
        googleDriveFileList.append(empty);
      }
      let publishedFiles = new Map();
      try { publishedFiles = await getPublishedFilesIndex(); }
      catch (publishError) { setDriveFilesStatus("Drive files loaded; published status could not be checked: " + (publishError.message || "Storage access error"), true); }
      files.forEach(file => {
        const item = document.createElement("li");
        item.className = "file-item";
        const info = document.createElement("div");
        info.className = "file-info";
        const name = document.createElement("div");
        name.className = "file-name";
        name.textContent = file.name || "Untitled file";
        const meta = document.createElement("div");
        meta.className = "file-meta";
        const size = Number(file.size || 0);
        meta.textContent = (file.mimeType || "Unknown type") + (size ? " · " + formatBytes(size) : "");
        info.append(name, meta);
        const actions = document.createElement("div");
        actions.className = "file-actions";
        const download = document.createElement("button");
        download.type = "button";
        download.textContent = "Download";
        download.addEventListener("click", () => downloadGoogleDriveFile(file, download));
        const category = document.createElement("select");
        category.className = "publish-category";
        category.setAttribute("aria-label", "Public category for " + (file.name || "Drive file"));
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Choose category";
        category.append(placeholder);
        PUBLIC_CATEGORIES.forEach(value => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = value.replace(/-/g, " ").replace(/\\b\\w/g, char => char.toUpperCase());
          category.append(option);
        });
        const safeName = safeFileName(file.name || "drive-file");
        const publishedCategory = publishedFiles.get(file.id);
        if (publishedCategory) category.value = publishedCategory;
        const publish = document.createElement("button");
        publish.type = "button";
        publish.className = "publish-button";
        publish.textContent = publishedCategory ? "Republish" : "Publish";
        publish.addEventListener("click", () => publishGoogleDriveFile(file, category.value, publish));
        const unpublish = document.createElement("button");
        unpublish.type = "button";
        unpublish.className = "unpublish-button";
        unpublish.textContent = "Unpublish";
        unpublish.disabled = !publishedCategory;
        unpublish.title = publishedCategory ? "Remove from " + publishedCategory : "This file is not published";
        unpublish.addEventListener("click", () => unpublishGoogleDriveFile(file, category.value || publishedCategory, unpublish));
        const canPublishDriveFile = ALLOWED_TYPES.has(file.mimeType);
        category.hidden = !currentPermissions.has("vault.publish") || !canPublishDriveFile;
        publish.hidden = !currentPermissions.has("vault.publish") || !canPublishDriveFile;
        unpublish.hidden = !currentPermissions.has("vault.publish") || !canPublishDriveFile;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "delete-button";
        remove.textContent = "Delete";
        remove.addEventListener("click", () => deleteGoogleDriveFile(file, item, remove));
        remove.hidden = !currentPermissions.has("drive.delete");
        actions.append(download, category, publish, unpublish, remove);
        item.append(info, actions);
        googleDriveFileList.append(item);
      });
      setDriveFilesStatus(files.length + " Google Drive file(s) listed.");
    } catch (error) {
      setDriveFilesStatus(error.message || "Google Drive listing failed.", true);
    } finally {
      if (googleDriveRefreshButton) googleDriveRefreshButton.disabled = !googleDriveConnected;
    }
  }

  async function publishGoogleDriveFile(file, category, button) {
    if (!currentPermissions.has("vault.publish")) {
      setDriveFilesStatus("Your role cannot publish documents.", true);
      return;
    }
    if (!category || !PUBLIC_CATEGORIES.includes(category)) {
      setDriveFilesStatus("Choose a public category before publishing.", true);
      return;
    }
    if (!window.confirm("Publish " + (file.name || "this Drive file") + " publicly in " + category.replace(/-/g, " ") + "? Anyone with the public library link can access it.")) return;
    button.disabled = true;
    try {
      setDriveFilesStatus("Publishing Drive reference…");
      const response = await googleDriveRequest("publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: file.id,
          category,
          title: file.name || "Drive document",
          mimeType: file.mimeType || "application/octet-stream",
          sizeBytes: Number(file.size || 0) || null
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not publish Drive file.");
      setDriveFilesStatus("Published " + (file.name || "Drive file") + " in " + category.replace(/-/g, " ") + ". No duplicate upload was created.");
      await loadGoogleDriveFiles();
    } catch (error) {
      setDriveFilesStatus("Drive publish failed: " + (error.message || "Storage upload failed."), true);
    } finally {
      button.disabled = false;
    }
  }

  async function unpublishGoogleDriveFile(file, category, button) {
    if (!category || !PUBLIC_CATEGORIES.includes(category)) {
      setDriveFilesStatus("Choose the category where this Drive file was published.", true);
      return;
    }
    if (!window.confirm("Remove this Drive file from the public library? The Google Drive original will remain unchanged.")) return;
    button.disabled = true;
    try {
      const response = await googleDriveRequest("unpublish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: file.id })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not unpublish Drive file.");
      setDriveFilesStatus("Removed from public library. The Google Drive original is unchanged.");
      await loadGoogleDriveFiles();
    } catch (error) {
      setDriveFilesStatus("Drive unpublish failed: " + (error.message || "Storage removal failed."), true);
    } finally {
      button.disabled = false;
    }
  }

  async function downloadGoogleDriveFile(file, button) {
    button.disabled = true;
    try {
      const response = await googleDriveRequest("download", { query: { id: file.id } });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Download failed.");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = file.name || "drive-file";
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setDriveFilesStatus("Downloaded " + (file.name || "file") + ".");
    } catch (error) {
      setDriveFilesStatus(error.message || "Google Drive download failed.", true);
    } finally {
      button.disabled = false;
    }
  }

  async function deleteGoogleDriveFile(file, item, button) {
    if (!window.confirm("Permanently delete " + (file.name || "this Drive file") + "?")) return;
    button.disabled = true;
    try {
      const response = await googleDriveRequest("delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: file.id })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Delete failed.");
      item.remove();
      setDriveFilesStatus("Deleted " + (file.name || "file") + " from Google Drive.");
    } catch (error) {
      setDriveFilesStatus(error.message || "Google Drive delete failed.", true);
      button.disabled = false;
    }
  }

  async function uploadGoogleDriveFile() {
    const file = googleDriveFileInput && googleDriveFileInput.files && googleDriveFileInput.files[0];
    if (!file) {
      setDriveFilesStatus("Choose a file first.", true);
      return;
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      setDriveFilesStatus("Only PDF, JPEG and PNG files are allowed.", true);
      return;
    }
    if (!file.size || file.size > 2 * 1024 * 1024 * 1024) {
      setDriveFilesStatus("Choose a non-empty file up to 2 GB.", true);
      return;
    }
    googleDriveUploadButton.disabled = true;
    googleDriveRefreshButton.disabled = true;
    try {
      setDriveFilesStatus("Preparing resumable Google Drive upload…");
      const sessionResponse = await googleDriveRequest("create-upload-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, mimeType: file.type, size: file.size })
      });
      const session = await sessionResponse.json();
      if (!sessionResponse.ok || !session.uploadUrl) throw new Error(session.error || "Could not start upload.");
      const chunkSize = Math.min(Number(session.chunkSize) || 4 * 1024 * 1024, 4 * 1024 * 1024);
      let uploaded = 0;
      while (uploaded < file.size) {
        const endExclusive = Math.min(uploaded + chunkSize, file.size);
        const chunk = file.slice(uploaded, endExclusive);
        const response = await googleDriveRequest("upload-chunk", {
          method: "POST",
          headers: {
            "X-Drive-Upload-Url": session.uploadUrl,
            "Content-Range": "bytes " + uploaded + "-" + (endExclusive - 1) + "/" + file.size
          },
          body: chunk
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok && response.status !== 308) throw new Error(result.error || "Upload failed at " + formatBytes(uploaded) + ".");
        uploaded = endExclusive;
        setDriveFilesStatus("Uploading to Google Drive… " + Math.round(uploaded / file.size * 100) + "%");
        if (result.complete) break;
      }
      googleDriveFileInput.value = "";
      setDriveFilesStatus("Upload completed. Refreshing Drive files…");
      await loadGoogleDriveFiles();
    } catch (error) {
      setDriveFilesStatus(error.message || "Google Drive upload failed.", true);
    } finally {
      googleDriveUploadButton.disabled = !googleDriveConnected;
      googleDriveRefreshButton.disabled = !googleDriveConnected;
    }
  }

  if (googleDriveButton) googleDriveButton.addEventListener("click", connectGoogleDrive);
  if (googleDriveRefreshButton) googleDriveRefreshButton.addEventListener("click", loadGoogleDriveFiles);
  if (googleDriveUploadButton) googleDriveUploadButton.addEventListener("click", uploadGoogleDriveFile);

  const googleDriveResult = new URLSearchParams(window.location.search).get("google_drive");
  if (googleDriveResult === "connected") {
    setGoogleDriveStatus("Google Drive account connected. Token storage confirmation received.");
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("google_drive");
    window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
  } else if (googleDriveResult === "error") {
    setGoogleDriveStatus("Google Drive connection failed. Check the Edge Function logs and try again.", true);
  }

  function setVaultStatus(message, isError = false) {
    vaultStatus.textContent = message;
    vaultStatus.style.color = isError ? "#a23c32" : "#53617b";
  }

  function showAdminSession(isAdmin) {
    loginView.hidden = isAdmin;
    sessionPanel.hidden = !isAdmin;
    status.textContent = "";
    if (isAdmin) {
      if (!supabaseClient) {
        setVaultStatus("Storage SDK did not load. Refresh this page before using the vault.", true);
      } else {
        loadFiles();
      }
    } else {
      currentFiles = [];
      currentDriveFiles = [];
      driveFilesLoaded = false;
      fileList.replaceChildren();
      updateStats();
      updateDriveOverview();
      updateDashboardActivity();
    }
  }

  function safeFileName(name) {
    const cleaned = name.normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(-100);
    return cleaned || "document";
  }

  function formatBytes(bytes) {
    return vaultStorage.formatBytes(bytes);
  }

  function updateStats(files = currentFiles) {
    const usage = vaultStorage.calculateUsage(files);
    if (countStat) countStat.textContent = String(usage.fileCount);
    if (storageStat) {
      if (usage.unknownSizeCount > 0) {
        storageStat.textContent = "Unavailable";
        storageStat.title = "Size metadata is unavailable for " + usage.unknownSizeCount +
          " of " + usage.fileCount + " private files. The total is not estimated.";
      } else {
        storageStat.textContent = formatBytes(usage.totalBytes);
        storageStat.title = "Combined size of all " + usage.fileCount + " listed private files.";
      }
    }
    updateVaultFileCount();
    updateDriveOverview();
  }

  function updateVaultFileCount() {
    if (!countLabel || !fileList) return;
    const items = Array.from(fileList.querySelectorAll(".file-item"));
    const visible = items.filter(item => !item.hidden).length;
    const total = currentFiles.length;
    countLabel.textContent = visible === total
      ? total + (total === 1 ? " file" : " files")
      : "Showing " + visible + " of " + total;
  }

  function applyVaultSearch() {
    const query = (fileSearch && fileSearch.value || "").trim().toLowerCase();
    Array.from(fileList.children).forEach(item => {
      if (!item.classList.contains("file-item")) return;
      item.hidden = Boolean(query) && !item.textContent.toLowerCase().includes(query);
    });
    updateVaultFileCount();
  }

  function updateDriveOverview() {
    if (driveCountStat) driveCountStat.textContent = googleDriveConnected && driveFilesLoaded ? String(currentDriveFiles.length) : "—";
    if (driveCountNote) driveCountNote.textContent = !googleDriveConnected
      ? "Connect Google Drive to view files"
      : driveFilesLoaded ? "Files visible to PixelForge" : "Waiting for file list";
    if (driveStatusStat) {
      driveStatusStat.textContent = googleDriveConnected ? "Connected" : "Not connected";
      driveStatusStat.classList.toggle("secure-value", googleDriveConnected);
      driveStatusStat.classList.toggle("status-muted", !googleDriveConnected);
    }
    if (driveStatusNote) driveStatusNote.textContent = googleDriveConnected
      ? "Owner account authorization active"
      : "No active Drive connection";
  }

  function updateDashboardActivity() {
    if (!activityList || !activityStatus) return;
    const entries = [];
    currentFiles.forEach(file => {
      const timestamp = file.created_at || file.updated_at || file.metadata?.lastModified;
      entries.push({
        source: "Private vault",
        name: displayFileName(file.name || "Private document"),
        timestamp: timestamp ? new Date(timestamp) : null
      });
    });
    if (googleDriveConnected) {
      currentDriveFiles.forEach(file => {
        entries.push({
          source: "Google Drive",
          name: file.name || "Drive file",
          timestamp: file.modifiedTime ? new Date(file.modifiedTime) : null
        });
      });
    }
    const validEntries = entries.filter(entry => !entry.timestamp || !Number.isNaN(entry.timestamp.getTime()));
    validEntries.sort((a, b) => {
      if (!a.timestamp && !b.timestamp) return 0;
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return b.timestamp - a.timestamp;
    });
    if (overviewActivityList) {
      overviewActivityList.replaceChildren();
      if (!validEntries.length) {
        const empty = document.createElement("li");
        empty.className = "empty-state";
        empty.textContent = "No recent file updates.";
        overviewActivityList.append(empty);
        if (overviewActivityStatus) overviewActivityStatus.textContent = "Storage activity will appear here.";
      } else {
        validEntries.slice(0, 3).forEach(entry => {
          const item = document.createElement("li");
          const title = document.createElement("strong");
          title.textContent = entry.name;
          const meta = document.createElement("small");
          meta.textContent = entry.source + (entry.timestamp ? " · " + entry.timestamp.toLocaleDateString() : "");
          item.append(title, meta);
          overviewActivityList.append(item);
        });
        if (overviewActivityStatus) overviewActivityStatus.textContent = "Latest " + Math.min(3, validEntries.length) + " storage file updates.";
      }
    }
    activityList.replaceChildren();
    if (!validEntries.length) {
      const empty = document.createElement("li");
      empty.className = "empty-state";
      empty.textContent = "No file activity is available yet.";
      activityList.append(empty);
      activityStatus.textContent = "Activity is based on real files returned by connected storage. No records are currently available.";
      return;
    }
    validEntries.slice(0, 6).forEach(entry => {
      const item = document.createElement("li");
      item.className = "activity-item";
      const marker = document.createElement("span");
      marker.className = entry.source === "Google Drive" ? "activity-marker drive" : "activity-marker vault";
      marker.textContent = entry.source === "Google Drive" ? "G" : "▤";
      const details = document.createElement("div");
      details.className = "activity-details";
      const name = document.createElement("strong");
      name.textContent = entry.name;
      const meta = document.createElement("span");
      meta.textContent = entry.source + (entry.timestamp ? " · " + entry.timestamp.toLocaleString() : " · Date unavailable");
      details.append(name, meta);
      item.append(marker, details);
      activityList.append(item);
    });
    activityStatus.textContent = "Showing " + Math.min(validEntries.length, 6) + " of " + validEntries.length + " available files. This is file activity, not a full admin audit log.";
  }

  function showEmpty(message) {
    const item = document.createElement("li");
    item.className = "empty-state";
    item.textContent = message;
    fileList.replaceChildren(item);
  }

  function displayFileName(storedName) {
    return storedName.replace(/^\\d{10,}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "");
  }

  async function listAllStorageFiles(bucketName, folderPath) {
    const allFiles = [];
    const pageSize = 100;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabaseClient.storage.from(bucketName).list(folderPath, {
        limit: pageSize,
        offset,
        sortBy: { column: "created_at", order: "desc" }
      });
      if (error) throw error;
      const page = (data || []).filter(item => vaultStorage.isFileEntry(item));
      allFiles.push(...page);
      if (!data || data.length < pageSize) break;
    }
    return allFiles;
  }

  async function getPublishedFilesIndex() {
    const published = new Map();
    if (!supabaseClient || !currentUserUid || !currentPermissions.has("vault.read")) return published;
    const results = await Promise.all(PUBLIC_CATEGORIES.map(async category => {
      const files = await listAllStorageFiles(PUBLIC_BUCKET, category);
      return files.map(file => ({ name: file.name, category }));
    }));
    results.flat().forEach(file => {
      if (file.name.startsWith(currentUserUid + "-")) {
        published.set(file.name.slice(currentUserUid.length + 1), file.category);
      }
    });
    const driveResponse = await googleDriveRequest("published-list");
    const drivePayload = await driveResponse.json();
    if (!driveResponse.ok) throw new Error(drivePayload.error || "Could not load published Drive files.");
    (drivePayload.documents || []).forEach(item => {
      if (item.drive_file_id) published.set(item.drive_file_id, item.category);
    });
    return published;
  }

  async function loadFiles() {
    if (!supabaseClient || !auth.currentUser || !currentPermissions.has("vault.read")) return;
    refreshButton.disabled = true;
    setVaultStatus("Loading private documents…");
    try {
      const files = await listAllStorageFiles(BUCKET, currentUserUid);
      currentFiles = files;
      let publishedFiles = new Map();
      let publishStatusWarning = "";
      try { publishedFiles = await getPublishedFilesIndex(); }
      catch (publishError) { publishStatusWarning = " Published status could not be checked: " + (publishError.message || "Storage access error"); }
      updateStats(files);
      if (publishedCountStat) publishedCountStat.textContent = String(publishedFiles.size);
      updateDashboardActivity();
      if (!files.length) {
        showEmpty("No documents uploaded yet.");
      } else {
        fileList.replaceChildren();
        files.forEach(item => {
          const path = currentUserUid + "/" + item.name;
          const li = document.createElement("li");
          li.className = "file-item";
          const info = document.createElement("div");
          info.className = "file-info";
          const name = document.createElement("div");
          name.className = "file-name";
          name.textContent = displayFileName(item.name);
          const meta = document.createElement("div");
          meta.className = "file-meta";
          const sizeBytes = vaultStorage.getFileSizeBytes(item);
          meta.textContent = sizeBytes === null ? "Size unavailable" : formatBytes(sizeBytes);
          info.append(name, meta);

          const actions = document.createElement("div");
          actions.className = "file-actions";
          const download = document.createElement("button");
          download.type = "button";
          download.textContent = "Download";
          download.addEventListener("click", () => downloadFile(path, item.name, download));
          const category = document.createElement("select");
          category.className = "publish-category";
          category.setAttribute("aria-label", "Public category");
          const placeholder = document.createElement("option");
          placeholder.value = "";
          placeholder.textContent = "Choose category";
          category.append(placeholder);
          PUBLIC_CATEGORIES.forEach(value => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value.replace(/-/g, " ").replace(/\\b\\w/g, char => char.toUpperCase());
            category.append(option);
          });
          const publishedCategory = publishedFiles.get(item.name);
          if (publishedCategory) category.value = publishedCategory;
          const publish = document.createElement("button");
          publish.type = "button";
          publish.className = "publish-button";
          publish.textContent = publishedCategory ? "Republish" : "Publish";
          publish.addEventListener("click", () => publishFile(path, item.name, category.value, publish));
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "delete-button";
          remove.textContent = "Delete";
          remove.addEventListener("click", () => deleteFile(path, li, remove));
          const unpublish = document.createElement("button");
          unpublish.type = "button";
          unpublish.className = "unpublish-button";
          unpublish.textContent = "Unpublish";
          unpublish.addEventListener("click", () => unpublishFile(item.name, category.value || publishedCategory, unpublish));
          unpublish.disabled = !publishedCategory;
          unpublish.title = publishedCategory ? "Remove from " + publishedCategory : "This file is not published";
          category.hidden = !currentPermissions.has("vault.publish");
          publish.hidden = !currentPermissions.has("vault.publish");
          unpublish.hidden = !currentPermissions.has("vault.publish");
          remove.hidden = !currentPermissions.has("vault.delete");
          actions.append(download, category, publish, unpublish, remove);
          li.append(info, actions);
          fileList.append(li);
        });
      }
      applyVaultSearch();
      setVaultStatus(files.length + " private document(s) listed." + publishStatusWarning, Boolean(publishStatusWarning));
    } catch (error) {
      showEmpty("Could not load documents. Check the Storage policies and Firebase token.");
      setVaultStatus("Storage list failed: " + (error.message || "Unknown error"), true);
    } finally {
      refreshButton.disabled = false;
    }
  }

  async function publishFile(privatePath, fileName, category, button) {
    if (!category || !PUBLIC_CATEGORIES.includes(category)) {
      setVaultStatus("Choose a public category before publishing.", true);
      return;
    }
    if (!window.confirm("Publish this file publicly in " + category.replace(/-/g, " ") + "? Anyone with the public library link will be able to access it.")) return;
    button.disabled = true;
    try {
      const { data: downloaded, error: downloadError } = await supabaseClient.storage.from(BUCKET).download(privatePath);
      if (downloadError) throw downloadError;
      const publicPath = category + "/" + currentUserUid + "-" + fileName;
      const { error: uploadError } = await supabaseClient.storage.from(PUBLIC_BUCKET).upload(publicPath, downloaded, {
        cacheControl: "60",
        contentType: downloaded.type || "application/octet-stream",
        upsert: true
      });
      if (uploadError) throw uploadError;
      setVaultStatus("Published publicly in " + category.replace(/-/g, " ") + ". The private original remains private.");
      button.textContent = "Published";
      await loadFiles();
    } catch (error) {
      setVaultStatus("Publish failed: " + (error.message || "Check public bucket and its write policies."), true);
    } finally {
      button.disabled = false;
    }
  }

  async function unpublishFile(fileName, category, button) {
    if (!category || !PUBLIC_CATEGORIES.includes(category)) {
      setVaultStatus("Choose the category where this file was published.", true);
      return;
    }
    if (!window.confirm("Remove this file from the public website? The private original will remain in your vault.")) return;
    button.disabled = true;
    try {
      const publicPath = category + "/" + currentUserUid + "-" + fileName;
      const { error } = await supabaseClient.storage.from(PUBLIC_BUCKET).remove([publicPath]);
      if (error) throw error;
      setVaultStatus("Removed from public library. The private original is unchanged.");
      await loadFiles();
    } catch (error) {
      setVaultStatus("Unpublish failed: " + (error.message || "Check public bucket policies."), true);
    } finally {
      button.disabled = false;
    }
  }

  async function downloadFile(path, fileName, button) {
    button.disabled = true;
    try {
      const { data, error } = await supabaseClient.storage
        .from(BUCKET)
        .createSignedUrl(path, 60);
      if (error) throw error;
      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = fileName;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.append(link);
      link.click();
      link.remove();
      setVaultStatus("A private download link was generated. It expires in 60 seconds.");
    } catch (error) {
      setVaultStatus("Download failed: " + (error.message || "Unknown error"), true);
    } finally {
      button.disabled = false;
    }
  }

  async function deleteFile(path, listItem, button) {
    if (!window.confirm("Permanently delete this document?")) return;
    button.disabled = true;
    try {
      const { error } = await supabaseClient.storage.from(BUCKET).remove([path]);
      if (error) throw error;
      setVaultStatus("Document deleted. Refreshing vault and dashboard…");
      await loadFiles();
    } catch (error) {
      setVaultStatus("Delete failed: " + (error.message || "Unknown error"), true);
      button.disabled = false;
    }
  }

  function uploadLargeFile(bucketName, objectPath, file) {
    return new Promise(async (resolve, reject) => {
      try {
        const user = auth.currentUser;
        if (!user || !currentPermissions.has("vault.write")) {
          reject(new Error("Your account does not have upload permission."));
          return;
        }
        const token = await user.getIdToken();
        const projectRef = "zeueivmdzhkhonkyllij";
        const upload = new window.tus.Upload(file, {
          endpoint: "https://" + projectRef + ".storage.supabase.co/storage/v1/upload/resumable",
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: {
            authorization: "Bearer " + token,
            apikey: SUPABASE_PUBLISHABLE_KEY
          },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          chunkSize: 6 * 1024 * 1024,
          metadata: {
            bucketName,
            objectName: objectPath,
            contentType: file.type || "application/octet-stream",
            cacheControl: "0"
          },
          onError(error) {
            reject(error);
          },
          onProgress(bytesUploaded, bytesTotal) {
            const percent = Math.min(100, Math.round((bytesUploaded / bytesTotal) * 100));
            setVaultStatus("Uploading privately… " + percent + "% (" + formatBytes(bytesUploaded) + " / " + formatBytes(bytesTotal) + ")");
          },
          onSuccess() {
            resolve();
          }
        });
        const previous = await upload.findPreviousUploads();
        if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      } catch (error) {
        reject(error);
      }
    });
  }

  uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      setVaultStatus("Choose a PDF, JPG or PNG file first.", true);
      return;
    }
    if (!auth.currentUser || !currentPermissions.has("vault.write")) {
      setVaultStatus("Your account does not have upload permission.", true);
      return;
    }
    if (!supabaseClient) {
      setVaultStatus("Storage SDK is unavailable. Refresh and try again.", true);
      return;
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      setVaultStatus("Only PDF, JPEG and PNG files are allowed.", true);
      return;
    }
    if (file.size <= 0) {
      setVaultStatus("The selected file is empty. Choose a non-empty document.", true);
      return;
    }
    if (!window.tus || typeof window.tus.Upload !== "function") {
      setVaultStatus("The resumable upload service could not load. Refresh and try again.", true);
      return;
    }

    uploadButton.disabled = true;
    uploadButton.textContent = "Uploading…";
    setVaultStatus("Uploading privately…");
    try {
      const objectName = Date.now() + "-" + crypto.randomUUID() + "-" + safeFileName(file.name);
      const objectPath = currentUserUid + "/" + objectName;
      await uploadLargeFile(BUCKET, objectPath, file);
      fileInput.value = "";
      setVaultStatus("Upload successful. Refreshing document list…");
      await loadFiles();
    } catch (error) {
      setVaultStatus("Upload failed: " + (error.message || "Unknown error"), true);
    } finally {
      uploadButton.disabled = false;
      uploadButton.textContent = "Upload privately";
    }
  });

  refreshButton.addEventListener("click", loadFiles);
  fileSearch.addEventListener("input", applyVaultSearch);

  fileInput.addEventListener("change", () => {
    selectedFile.textContent = fileInput.files && fileInput.files[0]
      ? fileInput.files[0].name + " · " + formatBytes(fileInput.files[0].size)
      : "No file selected";
  });



  async function managementRequest(action, options = {}) {
    const user = auth.currentUser;
    if (!user) throw new Error("Please sign in again.");
    const headers = { "Authorization": "Bearer " + await user.getIdToken() };
    if (options.body) headers["Content-Type"] = "application/json";
    const response = await fetch(SUPABASE_URL + "/functions/v1/user-management?action=" + encodeURIComponent(action), {
      method: options.method || "GET", headers, body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "User-management request failed.");
    return payload;
  }




  async function settingsRequest(action, options = {}) {
    const user = auth.currentUser;
    if (!user || !currentPermissions.has(options.method === "POST" ? "settings.manage" : "settings.view")) {
      throw new Error("Administrator settings permission is required.");
    }
    const headers = { "Authorization": "Bearer " + await user.getIdToken() };
    if (options.body) headers["Content-Type"] = "application/json";
    const response = await fetch(SUPABASE_URL + "/functions/v1/site-settings?action=" + encodeURIComponent(action), {
      method: options.method || "GET", headers, body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Settings request failed.");
    return payload;
  }

  function setSettingsStatus(message, isError = false) {
    if (!settingsStatus) return;
    settingsStatus.textContent = message;
    settingsStatus.style.color = isError ? "#a23c32" : "#53617b";
  }

  async function loadSettings() {
    if (!currentPermissions.has("settings.view")) return;
    setSettingsStatus("Loading secure site settings…");
    try {
      const [payload, auditPayload] = await Promise.all([
        settingsRequest("list"), settingsRequest("audit")
      ]);
      const values = Object.fromEntries((payload.settings || []).map(item => [item.setting_key, item.setting_value]));
      const setValue = (id, value) => { const el = document.getElementById(id); if (el) el.value = value ?? ""; };
      const setChecked = (id, value) => { const el = document.getElementById(id); if (el) el.checked = value === true; };
      setValue("setting-site-name", values["site.name"]);
      setValue("setting-site-description", values["site.description"]);
      setValue("setting-contact-email", values["site.contact_email"]);
      setChecked("setting-maintenance-enabled", values["maintenance.enabled"]);
      setValue("setting-maintenance-message", values["maintenance.message"]);
      setChecked("setting-drive-auto", values["sync.drive.auto_enabled"]);
      setChecked("setting-vault-auto", values["sync.vault.auto_enabled"]);
      renderSettingsAudit(auditPayload.audit || []);
      document.querySelectorAll("[data-setting-save]").forEach(button => {
        button.hidden = !currentPermissions.has("settings.manage");
        button.disabled = !currentPermissions.has("settings.manage");
      });
      document.querySelectorAll("#settings input, #settings textarea").forEach(input => {
        input.disabled = !currentPermissions.has("settings.manage");
      });
      setSettingsStatus("Settings loaded. Changes are saved individually and recorded in the audit log.");
    } catch (error) {
      setSettingsStatus(error.message || "Could not load settings.", true);
    }
  }

  function renderSettingsAudit(entries) {
    if (!settingsAuditBody) return;
    settingsAuditBody.replaceChildren();
    if (!entries.length) {
      const row = document.createElement("tr"); const cell = document.createElement("td");
      cell.colSpan = 5; cell.className = "empty-state"; cell.textContent = "No settings changes recorded yet.";
      row.append(cell); settingsAuditBody.append(row);
    } else {
      entries.forEach(entry => {
        const row = document.createElement("tr");
        [entry.setting_key, JSON.stringify(entry.old_value), JSON.stringify(entry.new_value), entry.actor_uid,
          entry.created_at ? new Date(entry.created_at).toISOString().replace("T", " ").slice(0, 19) + " UTC" : "—"
        ].forEach(value => { const cell = document.createElement("td"); cell.textContent = String(value ?? "—"); row.append(cell); });
        settingsAuditBody.append(row);
      });
    }
    if (settingsAuditStatus) settingsAuditStatus.textContent = entries.length + " recent settings change(s).";
  }

  async function saveSetting(key, value, button) {
    if (!currentPermissions.has("settings.manage")) return;
    button.disabled = true;
    setSettingsStatus("Saving " + key + "…");
    try {
      await settingsRequest("update", { method: "POST", body: { key, value } });
      setSettingsStatus("Saved " + key + ". Audit history updated.");
      const audit = await settingsRequest("audit");
      renderSettingsAudit(audit.audit || []);
    } catch (error) {
      setSettingsStatus(error.message || "Could not save setting.", true);
    } finally {
      button.disabled = false;
    }
  }

  document.querySelectorAll("[data-setting-save]").forEach(button => button.addEventListener("click", () => {
    const group = button.getAttribute("data-setting-save");
    if (group === "site.identity") {
      saveSetting("site.name", document.getElementById("setting-site-name").value, button)
        .then(() => saveSetting("site.description", document.getElementById("setting-site-description").value, button))
        .then(() => saveSetting("site.contact_email", document.getElementById("setting-contact-email").value, button));
    } else if (group === "maintenance") {
      saveSetting("maintenance.message", document.getElementById("setting-maintenance-message").value, button)
        .then(() => saveSetting("maintenance.enabled", document.getElementById("setting-maintenance-enabled").checked, button));
    } else if (group === "sync") {
      saveSetting("sync.drive.auto_enabled", document.getElementById("setting-drive-auto").checked, button)
        .then(() => saveSetting("sync.vault.auto_enabled", document.getElementById("setting-vault-auto").checked, button));
    }
  }));
  if (refreshSettingsButton) refreshSettingsButton.addEventListener("click", loadSettings);

  async function loadOverviewAnalytics() {
    if (!currentPermissions.has("analytics.view") || !auth.currentUser || !overviewPageViewsStat) return;
    overviewPageViewsStat.textContent = "…";
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(SUPABASE_URL + "/functions/v1/analytics?action=summary&days=7", {
        headers: { "Authorization": "Bearer " + token }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unavailable");
      overviewPageViewsStat.textContent = Number(payload.totalPageViews || 0).toLocaleString();
      if (overviewPageViewsNote) overviewPageViewsNote.textContent = "Last " + payload.days + " days";
    } catch (_) {
      overviewPageViewsStat.textContent = "—";
      if (overviewPageViewsNote) overviewPageViewsNote.textContent = "Analytics unavailable";
    }
  }

  async function loadAnalyticsDashboard() {
    if (!currentPermissions.has("analytics.view") || !auth.currentUser) return;
    const statusElement = document.getElementById("analytics-status");
    const totalElement = document.getElementById("analytics-total-views");
    const visitorsElement = document.getElementById("analytics-total-visitors");
    const locationsElement = document.getElementById("analytics-locations");
    const chart = document.getElementById("analytics-daily-chart");
    const topPages = document.getElementById("analytics-top-pages");
    if (!statusElement || !totalElement || !chart || !topPages || !visitorsElement || !locationsElement) return;
    const sequence = ++analyticsLoadSequence;
    const days = analyticsRange ? analyticsRange.value : "30";
    statusElement.textContent = "Loading website analytics…";
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(SUPABASE_URL + "/functions/v1/analytics?action=summary&days=" + encodeURIComponent(days), {
        headers: { "Authorization": "Bearer " + token }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Analytics could not be loaded.");
      if (sequence !== analyticsLoadSequence) return;
      totalElement.textContent = Number(payload.totalPageViews || 0).toLocaleString();
      visitorsElement.textContent = Number(payload.uniqueVisitors || 0).toLocaleString();
      statusElement.textContent = "Showing the last " + payload.days + " days · Updated just now.";
      renderAnalyticsChart(Array.isArray(payload.daily) ? payload.daily : [], chart);
      renderAnalyticsTopPages(Array.isArray(payload.topPages) ? payload.topPages : [], topPages);
      renderAnalyticsLocations(Array.isArray(payload.locations) ? payload.locations : [], locationsElement);
    } catch (error) {
      if (sequence !== analyticsLoadSequence) return;
      statusElement.textContent = error.message || "Analytics could not be loaded.";
      totalElement.textContent = "—";
      visitorsElement.textContent = "—";
      chart.replaceChildren();
      topPages.replaceChildren();
      locationsElement.replaceChildren();
      const empty = document.createElement("li");
      empty.className = "empty-state";
      empty.textContent = "Analytics are unavailable until the database setup and Edge Function deployment are complete.";
      topPages.append(empty);
    }
  }

  function renderAnalyticsChart(days, root) {
    root.replaceChildren();
    if (!days.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No page views recorded in this date range yet.";
      root.append(empty);
      return;
    }
    const max = Math.max(1, ...days.map(item => Number(item.views) || 0));
    days.forEach(item => {
      const column = document.createElement("div");
      column.className = "analytics-bar-column";
      const value = document.createElement("span");
      value.className = "analytics-bar-value";
      value.textContent = Number(item.views || 0).toLocaleString();
      const bar = document.createElement("div");
      bar.className = "analytics-bar";
      bar.style.height = Math.max(3, (Number(item.views || 0) / max) * 120) + "px";
      bar.title = item.date + ": " + value.textContent + " views";
      const label = document.createElement("small");
      label.textContent = String(item.date || "").slice(5);
      column.append(value, bar, label);
      root.append(column);
    });
  }

  function renderAnalyticsTopPages(pages, root) {
    root.replaceChildren();
    if (!pages.length) {
      const empty = document.createElement("li");
      empty.className = "empty-state";
      empty.textContent = "No page views recorded yet.";
      root.append(empty);
      return;
    }
    pages.forEach(item => {
      const li = document.createElement("li");
      const path = document.createElement("span");
      path.textContent = item.path;
      const views = document.createElement("strong");
      views.textContent = Number(item.views || 0).toLocaleString();
      li.append(path, views);
      root.append(li);
    });
  }


  function renderAnalyticsLocations(locations, root) {
    root.replaceChildren();
    if (!locations.length) {
      const empty = document.createElement("li");
      empty.className = "empty-state";
      empty.textContent = "No country data has been received from the trusted Supabase edge for this period yet.";
      root.append(empty);
      return;
    }
    locations.forEach(item => {
      const li = document.createElement("li");
      const label = document.createElement("span");
      const countryCode = item.country || "";
      let country = countryCode || "Unknown";
      if (/^[A-Z]{2}$/.test(countryCode) && typeof Intl.DisplayNames === "function") {
        try { country = new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) || countryCode; } catch (_) {}
      }
      label.textContent = item.region ? country + " · " + item.region : country;
      const visitors = document.createElement("strong");
      visitors.textContent = Number(item.visitors || 0).toLocaleString();
      li.append(label, visitors);
      root.append(li);
    });
  }

  if (analyticsRange) analyticsRange.addEventListener("change", loadAnalyticsDashboard);


  function setSecurityLogsStatus(message, isError = false) {
    if (!securityLogsStatus) return;
    securityLogsStatus.textContent = message;
    securityLogsStatus.style.color = isError ? "#a23c32" : "#53617b";
  }

  async function securityLogsRequest(action, options = {}) {
    const user = auth.currentUser;
    if (!user) throw new Error("Please sign in again.");
    const headers = { "Authorization": "Bearer " + await user.getIdToken() };
    if (options.body) headers["Content-Type"] = "application/json";
    const response = await fetch(SUPABASE_URL + "/functions/v1/analytics?action=" + encodeURIComponent(action), {
      method: options.method || "GET", headers, body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Security logs request failed.");
    return payload;
  }

  async function loadSecurityLogs() {
    if (!currentPermissions.has("security.logs.view") || !securityLogsBody) return;
    setSecurityLogsStatus("Loading encrypted security logs…");
    try {
      const payload = await securityLogsRequest("security-logs");
      securityLogsBody.replaceChildren();
      if (!payload.logs || !payload.logs.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 7; cell.className = "empty-state"; cell.textContent = "No security logs recorded yet.";
        row.append(cell); securityLogsBody.append(row);
      } else {
        payload.logs.forEach(log => {
          const row = document.createElement("tr");
          [log.ipAddress, log.ipAddress && log.ipAddress.includes(":") ? "IPv6" : "IPv4", log.ipSource === "supabase-edge-cf-connecting-ip" ? "Supabase trusted edge" : log.ipSource === "unavailable" ? "Hosting IP unavailable" : log.ipSource === "cf-connecting-ip" ? "Legacy edge IP" : "Unknown / legacy", (log.localIpAddress ? log.localIpAddress + " (browser-reported)" : "Not shared"), log.eventType, log.pagePath, new Date(log.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }) + " IST"].forEach(value => {
            const cell = document.createElement("td"); cell.textContent = String(value ?? "—"); row.append(cell);
          });
          securityLogsBody.append(row);
        });
      }
      setSecurityLogsStatus((payload.logs || []).length + " recent log(s) loaded · 90-day automatic retention.");
    } catch (error) {
      setSecurityLogsStatus(error.message || "Could not load security logs.", true);
    }
  }

  if (refreshSecurityLogsButton) refreshSecurityLogsButton.addEventListener("click", loadSecurityLogs);
  if (deleteSecurityLogsButton) deleteSecurityLogsButton.addEventListener("click", async () => {
    if (!currentPermissions.has("security.logs.delete")) return;
    if (!window.confirm("Delete ALL currently stored visitor security logs? This cannot be undone.")) return;
    deleteSecurityLogsButton.disabled = true;
    try {
      const result = await securityLogsRequest("delete-security-logs", { method: "POST", body: {} });
      setSecurityLogsStatus("Manually deleted " + Number(result.deletedCount || 0).toLocaleString() + " security log(s).");
      await loadSecurityLogs();
    } catch (error) {
      setSecurityLogsStatus(error.message || "Could not delete security logs.", true);
    } finally {
      deleteSecurityLogsButton.disabled = false;
    }
  });

  function setUsersStatus(message, isError = false) {
    if (!usersStatus) return;
    usersStatus.textContent = message;
    usersStatus.style.color = isError ? "#a23c32" : "#53617b";
  }

  async function loadUsersAndPermissions() {
    if (!currentPermissions.has("users.manage")) return;
    setUsersStatus("Loading workspace users…");
    try {
      const payload = await managementRequest("list");
      renderUsers(payload.users || []);
      renderPermissions(payload.permissions || []);
      const totalUsers = (payload.users || []).length;
      if (userCountStat) userCountStat.textContent = String(totalUsers);
      setUsersStatus(totalUsers + " user account(s) registered.");
    } catch (error) {
      setUsersStatus(error.message || "Could not load users.", true);
    }
  }

  function renderUsers(users) {
    if (!usersTableBody) return;
    usersTableBody.replaceChildren();
    if (!users.length) {
      const row = document.createElement("tr");
      row.innerHTML = '<td colspan="4" class="empty-state">No users are registered.</td>';
      usersTableBody.append(row);
      return;
    }
    users.forEach(user => {
      const row = document.createElement("tr");
      const email = document.createElement("td");
      email.textContent = user.email || user.uid;
      const roleCell = document.createElement("td");
      const role = document.createElement("select");
      ["admin", "editor", "viewer"].forEach(value => {
        const option = document.createElement("option");
        option.value = value; option.textContent = value[0].toUpperCase() + value.slice(1);
        role.append(option);
      });
      role.value = user.role;
      role.disabled = user.uid === ADMIN_UID || user.uid === currentUserUid;
      roleCell.append(role);
      const stateCell = document.createElement("td");
      stateCell.textContent = user.status;
      const actionCell = document.createElement("td");
      const save = document.createElement("button");
      save.type = "button"; save.textContent = "Save role"; save.disabled = user.uid === ADMIN_UID || user.uid === currentUserUid;
      save.addEventListener("click", async () => {
        save.disabled = true;
        try { await managementRequest("set-role", { method: "POST", body: { uid: user.uid, role: role.value } }); await loadUsersAndPermissions(); }
        catch (error) { setUsersStatus(error.message, true); save.disabled = false; }
      });
      const toggle = document.createElement("button");
      toggle.type = "button"; toggle.className = user.status === "active" ? "danger" : "";
      toggle.textContent = user.status === "active" ? "Suspend" : "Reactivate";
      toggle.disabled = user.uid === ADMIN_UID || user.uid === currentUserUid;
      toggle.addEventListener("click", async () => {
        toggle.disabled = true;
        try { await managementRequest("set-status", { method: "POST", body: { uid: user.uid, status: user.status === "active" ? "suspended" : "active" } }); await loadUsersAndPermissions(); }
        catch (error) { setUsersStatus(error.message, true); toggle.disabled = false; }
      });
      actionCell.append(save, toggle);
      row.append(email, roleCell, stateCell, actionCell);
      usersTableBody.append(row);
    });
  }

  function renderPermissions(permissions) {
    if (!permissionsTableBody) return;
    permissionsTableBody.replaceChildren();
    const names = [...new Set(permissions.map(item => item.permission))].sort();
    names.forEach(permission => {
      const row = document.createElement("tr");
      const label = document.createElement("td"); label.textContent = permission;
      row.append(label);
      ["admin", "editor", "viewer"].forEach(roleName => {
        const cell = document.createElement("td");
        const record = permissions.find(item => item.role === roleName && item.permission === permission);
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox"; checkbox.className = "permission-toggle";
        checkbox.checked = Boolean(record && record.allowed);
        checkbox.disabled = (roleName === "admin" && ["users.manage", "roles.manage", "dashboard.view"].includes(permission)) || (roleName !== "admin" && ["users.manage", "roles.manage"].includes(permission));
        checkbox.setAttribute("aria-label", roleName + " " + permission);
        checkbox.addEventListener("change", async () => {
          checkbox.disabled = true;
          try { await managementRequest("set-permission", { method: "POST", body: { role: roleName, permission, allowed: checkbox.checked } }); setUsersStatus("Permission updated."); }
          catch (error) { checkbox.checked = !checkbox.checked; setUsersStatus(error.message, true); }
          finally { checkbox.disabled = false; }
        });
        cell.append(checkbox); row.append(cell);
      });
      permissionsTableBody.append(row);
    });
  }

  async function createWorkspaceUser(event) {
    event.preventDefault();
    const email = newUserEmail.value.trim().toLowerCase();
    const role = newUserRole.value;
    if (!email || !currentPermissions.has("users.manage")) return;
    createUserButton.disabled = true;
    setUsersStatus("Creating Firebase account…");
    let provisioner = null;
    let createdUser = null;
    try {
      const appName = "PixelForgeProvisioner";
      provisioner = firebase.apps.find(app => app.name === appName) || firebase.initializeApp(firebaseConfig, appName);
      const provisionerAuth = provisioner.auth();
      const temporaryPassword = crypto.randomUUID() + "Aa1!";
      const credential = await provisionerAuth.createUserWithEmailAndPassword(email, temporaryPassword);
      createdUser = credential.user;
      await managementRequest("assign", { method: "POST", body: { uid: createdUser.uid, email, role } });
      await provisionerAuth.sendPasswordResetEmail(email);
      await provisionerAuth.signOut();
      userCreateForm.reset();
      setUsersStatus("User created as " + role + ". A password-setup email was sent to " + email + ".");
      await loadUsersAndPermissions();
    } catch (error) {
      if (createdUser) {
        try {
          await managementRequest("set-status", { method: "POST", body: { uid: createdUser.uid, status: "suspended" } });
        } catch (_) {}
        try { await createdUser.delete(); } catch (_) {}
      }
      setUsersStatus(error.message || "Could not create user.", true);
    } finally {
      createUserButton.disabled = false;
    }
  }

  async function loadRoleSession(user) {
    const session = await managementRequest("session");
    currentUserUid = session.uid;
    currentUserRole = session.role;
    currentPermissions = new Set(session.permissions || []);
    if (!currentPermissions.has("dashboard.view")) throw new Error("Dashboard access is not permitted.");
    if (usersNavLink) usersNavLink.hidden = !currentPermissions.has("users.manage");
    if (settingsNavLink) settingsNavLink.hidden = !currentPermissions.has("settings.view");
    if (analyticsNavLink) analyticsNavLink.hidden = !currentPermissions.has("analytics.view");
    if (securityLogsNavLink) securityLogsNavLink.hidden = !currentPermissions.has("security.logs.view");
    if (deleteSecurityLogsButton) deleteSecurityLogsButton.hidden = !currentPermissions.has("security.logs.delete");
    if (googleDriveNavLink) googleDriveNavLink.hidden = !currentPermissions.has("drive.read");
    syncSidebarNavigation();
    if (googleDriveButton) googleDriveButton.hidden = currentUserUid !== ADMIN_UID;
    if (googleDriveUploadButton) googleDriveUploadButton.hidden = !currentPermissions.has("drive.write");
    const uploadPanel = document.querySelector(".upload-panel");
    if (uploadPanel) uploadPanel.hidden = !currentPermissions.has("vault.write");
    const roleLabel = document.querySelector(".account-chip > span:nth-child(2)");
    if (roleLabel) roleLabel.textContent = currentUserRole[0].toUpperCase() + currentUserRole.slice(1);
    document.querySelectorAll("[data-permission]").forEach(element => {
      element.hidden = !currentPermissions.has(element.getAttribute("data-permission"));
    });
    showAdminSession(true);
    if (currentPermissions.has("drive.read")) refreshGoogleDriveStatus();
    if (currentPermissions.has("users.manage")) loadUsersAndPermissions();
    if (currentPermissions.has("analytics.view")) loadOverviewAnalytics();
  }

  if (userCreateForm) userCreateForm.addEventListener("submit", createWorkspaceUser);
  const refreshUsersButton = document.getElementById("refresh-users");
  if (refreshUsersButton) refreshUsersButton.addEventListener("click", loadUsersAndPermissions);

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      currentUserUid = null; currentUserRole = null; currentPermissions = new Set();
      showAdminSession(false);
      return;
    }
    try {
      await loadRoleSession(user);
    } catch (error) {
      showAdminSession(false);
      status.textContent = error.message || "This account has no active PixelForge access.";
      try { await auth.signOut(); } catch (_) {}
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "";
    loginButton.disabled = true;
    loginButton.textContent = "Signing in…";
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    try {
      const credential = await auth.signInWithEmailAndPassword(email, password);
      await loadRoleSession(credential.user);
    } catch (error) {
      const safeMessages = {
        "auth/invalid-credential": "Email or password is incorrect.",
        "auth/invalid-email": "Enter a valid email address.",
        "auth/too-many-requests": "Too many attempts. Wait a while and try again.",
        "auth/network-request-failed": "Network error. Check your connection and retry."
      };
      status.textContent = safeMessages[error.code] || ("Sign-in failed (" + (error.code || "unknown-error") + "). Check Firebase Authentication settings and the account, then retry.");
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = "Sign in securely";
      document.getElementById("password").value = "";
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      await auth.signOut();
      status.textContent = "You have been signed out.";
    } catch (_) {
      status.textContent = "Sign-out failed. Please retry.";
    }
  });
})();
