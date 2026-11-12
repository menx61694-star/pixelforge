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
  const googleDriveNavLink = document.getElementById("google-drive-nav-link");
  const userCreateForm = document.getElementById("user-create-form");
  const usersStatus = document.getElementById("users-status");
  const usersTableBody = document.getElementById("users-table-body");
  const permissionsTableBody = document.getElementById("permissions-table-body");
  const newUserEmail = document.getElementById("new-user-email");
  const newUserRole = document.getElementById("new-user-role");
  const createUserButton = document.getElementById("create-user-button");

  const sidebarLinks = Array.from(document.querySelectorAll(".sidebar .nav-link"));
  const dashboardPages = ["overview", "recent-activity", "documents", "google-drive", "users"]
    .map(id => document.getElementById(id))
    .filter(Boolean);
  function syncSidebarNavigation() {
    const requestedPage = (window.location.hash || "#overview").slice(1);
    let activePage = dashboardPages.some(page => page.id === requestedPage) ? requestedPage : "overview";
    const pagePermissions = { overview: "dashboard.view", "recent-activity": "activity.view", documents: "vault.read", "google-drive": "drive.read", users: "users.manage" };
    if (currentUserUid && !currentPermissions.has(pagePermissions[activePage])) activePage = "overview";
    dashboardPages.forEach(page => { page.hidden = page.id !== activePage; });
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
      const { error } = await supabaseClient.from("pixel_forge_published_documents").upsert({
        source: "google_drive",
        owner_uid: currentUserUid,
        drive_file_id: file.id,
        storage_path: null,
        category,
        title: file.name || "Drive document",
        mime_type: file.mimeType || "application/octet-stream",
        size_bytes: Number(file.size || 0) || null,
        published: true,
        updated_at: new Date().toISOString()
      }, { onConflict: "source,drive_file_id" });
      if (error) throw error;
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
      const { error } = await supabaseClient.from("pixel_forge_published_documents")
        .delete()
        .eq("source", "google_drive")
        .eq("drive_file_id", file.id)
        .eq("owner_uid", currentUserUid);
      if (error) throw error;
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
    const { data: drivePublished, error: drivePublishError } = await supabaseClient
      .from("pixel_forge_published_documents")
      .select("drive_file_id,category,title")
      .eq("source", "google_drive")
      .eq("owner_uid", currentUserUid)
      .eq("published", true);
    if (drivePublishError) throw drivePublishError;
    (drivePublished || []).forEach(item => {
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
      setUsersStatus((payload.users || []).length + " user account(s) registered.");
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
