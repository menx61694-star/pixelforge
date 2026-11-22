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
  const bulkToolbar = document.getElementById("bulk-actions-toolbar");
  const selectAllVaultFiles = document.getElementById("select-all-vault-files");
  const bulkSelectionCount = document.getElementById("bulk-selection-count");
  const bulkPublishCategory = document.getElementById("bulk-publish-category");
  const bulkTagsInput = document.getElementById("bulk-tags-input");
  const bulkApplyTagsButton = document.getElementById("bulk-apply-tags");
  const bulkPublishButton = document.getElementById("bulk-publish");
  const bulkUnpublishButton = document.getElementById("bulk-unpublish");
  const bulkDeleteButton = document.getElementById("bulk-delete");
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
  const driveBulkToolbar=document.getElementById("drive-bulk-toolbar"), driveSelectAll=document.getElementById("drive-select-all"), driveSelectedCount=document.getElementById("drive-selected-count"), driveBulkCategory=document.getElementById("drive-bulk-category"), driveBulkTags=document.getElementById("drive-bulk-tags"), driveBulkPublish=document.getElementById("drive-bulk-publish"), driveBulkUnpublish=document.getElementById("drive-bulk-unpublish"), driveBulkDelete=document.getElementById("drive-bulk-delete");
  const selectedDriveFileIds=new Set();
  function updateDriveBulkSelection(){const boxes=googleDriveFileList?Array.from(googleDriveFileList.querySelectorAll(".drive-file-select")):[], selected=boxes.filter(box=>selectedDriveFileIds.has(box.value)).length;if(driveBulkToolbar)driveBulkToolbar.hidden=!boxes.length;if(driveSelectedCount)driveSelectedCount.textContent=selected+" selected";if(driveSelectAll){driveSelectAll.checked=boxes.length>0&&selected===boxes.length;driveSelectAll.indeterminate=selected>0&&selected<boxes.length;}[driveBulkPublish,driveBulkUnpublish,driveBulkDelete].forEach(button=>{if(button)button.disabled=!selected;});}
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
        headers: { "apikey": SUPABASE_PUBLISHABLE_KEY, "Authorization": "Bearer " + idToken, "Content-Type": "application/json" }
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
    headers.set("apikey", SUPABASE_PUBLISHABLE_KEY);
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
        const selectWrap=document.createElement("label");selectWrap.className="drive-file-select-wrap";
        const select=document.createElement("input");select.type="checkbox";select.className="drive-file-select";select.value=file.id;select.checked=selectedDriveFileIds.has(file.id);select.setAttribute("aria-label","Select "+(file.name||"Drive file"));
        select.addEventListener("change",()=>{if(select.checked)selectedDriveFileIds.add(file.id);else selectedDriveFileIds.delete(file.id);updateDriveBulkSelection();});selectWrap.append(select);
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
        const publishedInfo = publishedFiles.get(file.id);
        const publishedCategory = publishedInfo && publishedInfo.category;
        if (publishedCategory) category.value = publishedCategory;
        const publish = document.createElement("button");
        publish.type = "button";
        publish.className = "publish-button";
        publish.textContent = publishedCategory ? "Republish" : "Publish";
        const tagsInput = document.createElement("input");
        tagsInput.type = "text";
        tagsInput.className = "publish-tags";
        tagsInput.placeholder = "Tags: CTET, UP Police";
        tagsInput.maxLength = 320;
        tagsInput.setAttribute("aria-label", "Public search tags for " + (file.name || "Drive file"));
        tagsInput.value = publishedInfo && Array.isArray(publishedInfo.tags) ? publishedInfo.tags.join(", ") : "";
        publish.addEventListener("click", () => publishGoogleDriveFile(file, category.value, tagsInput.value, publish));
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
        actions.append(download, category, tagsInput, publish, unpublish, remove);
        item.append(selectWrap, info, actions);
        googleDriveFileList.append(item);
      });
      updateDriveBulkSelection();
      setDriveFilesStatus(files.length + " Google Drive file(s) listed.");
    } catch (error) {
      setDriveFilesStatus(error.message || "Google Drive listing failed.", true);
    } finally {
      if (googleDriveRefreshButton) googleDriveRefreshButton.disabled = !googleDriveConnected;
    }
  }

  if(driveBulkCategory)PUBLIC_CATEGORIES.forEach(value=>{const option=document.createElement("option");option.value=value;option.textContent=value.replace(/-/g," ").toUpperCase();driveBulkCategory.append(option);});
  if(driveSelectAll)driveSelectAll.addEventListener("change",()=>{(googleDriveFileList?googleDriveFileList.querySelectorAll(".drive-file-select"):[]).forEach(box=>{box.checked=driveSelectAll.checked;if(box.checked)selectedDriveFileIds.add(box.value);else selectedDriveFileIds.delete(box.value);});updateDriveBulkSelection();});
  async function runDriveBulkAction(action){
    const selected=currentDriveFiles.filter(file=>selectedDriveFileIds.has(file.id));if(!selected.length)return;
    if(action==="publish"&&(!currentPermissions.has("vault.publish")||!driveBulkCategory.value)){setDriveFilesStatus("Choose a category and ensure you have publish permission.",true);return;}
    if(action==="unpublish"&&!currentPermissions.has("vault.publish")){setDriveFilesStatus("Your account does not have publish permission.",true);return;}
    if(action==="delete"&&!currentPermissions.has("drive.delete")){setDriveFilesStatus("Your account does not have Drive delete permission.",true);return;}
    const tags=normalizeDocumentTags(driveBulkTags?driveBulkTags.value:"");if(action==="publish"&&!tags){setDriveFilesStatus("Use up to 10 valid tags separated by commas.",true);return;}
    if(!window.confirm(action+" "+selected.length+" selected Google Drive file(s)?"))return;
    [driveBulkPublish,driveBulkUnpublish,driveBulkDelete].forEach(button=>{if(button)button.disabled=true;});let succeeded=0;const failures=[];
    for(const file of selected){try{let response;if(action==="publish"){if(!ALLOWED_TYPES.has(file.mimeType))throw new Error("Unsupported file type");response=await googleDriveRequest("publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fileId:file.id,category:driveBulkCategory.value,title:file.name||"Drive document",mimeType:file.mimeType||"application/octet-stream",sizeBytes:Number(file.size||0)||null,tags})});}else if(action==="unpublish"){response=await googleDriveRequest("unpublish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fileId:file.id})});}else{response=await googleDriveRequest("delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:file.id})});}const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||"Action failed");succeeded++;selectedDriveFileIds.delete(file.id);}catch(error){failures.push((file.name||file.id)+": "+(error.message||"Failed"));}}
    await loadGoogleDriveFiles();setDriveFilesStatus("Bulk "+action+": "+succeeded+"/"+selected.length+" succeeded."+(failures.length?" Failures: "+failures.slice(0,3).join("; "):""),failures.length>0);
  }
  if(driveBulkPublish)driveBulkPublish.addEventListener("click",()=>runDriveBulkAction("publish"));if(driveBulkUnpublish)driveBulkUnpublish.addEventListener("click",()=>runDriveBulkAction("unpublish"));if(driveBulkDelete)driveBulkDelete.addEventListener("click",()=>runDriveBulkAction("delete"));
  async function publishGoogleDriveFile(file, category, tagsText, button) {
    if (!currentPermissions.has("vault.publish")) {
      setDriveFilesStatus("Your role cannot publish documents.", true);
      return;
    }
    if (!category || !PUBLIC_CATEGORIES.includes(category)) {
      setDriveFilesStatus("Choose a public category before publishing.", true);
      return;
    }
    const tags = normalizeDocumentTags(tagsText);
    if (!tags) { setDriveFilesStatus("Use up to 10 tags, each 1–32 characters, separated by commas.", true); return; }
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
          sizeBytes: Number(file.size || 0) || null,
          tags
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

  async function uploadGoogleDriveSingleFile(file, fileIndex, fileCount) {
    setDriveFilesStatus("Preparing Google Drive upload (" + fileIndex + "/" + fileCount + "): " + file.name);
    const sessionResponse = await googleDriveRequest("create-upload-session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, mimeType: file.type, size: file.size })
    });
    const session = await sessionResponse.json();
    if (!sessionResponse.ok || !session.uploadUrl) throw new Error(session.error || "Could not start upload.");
    const chunkSize = Math.min(Number(session.chunkSize) || 4 * 1024 * 1024, 4 * 1024 * 1024);
    let uploaded = 0;
    while (uploaded < file.size) {
      const endExclusive = Math.min(uploaded + chunkSize, file.size);
      const response = await googleDriveRequest("upload-chunk", {
        method: "POST",
        headers: { "X-Drive-Upload-Url": session.uploadUrl, "Content-Range": "bytes " + uploaded + "-" + (endExclusive - 1) + "/" + file.size },
        body: file.slice(uploaded, endExclusive)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok && response.status !== 308) throw new Error(result.error || "Upload failed at " + formatBytes(uploaded) + ".");
      uploaded = endExclusive;
      setDriveFilesStatus("Uploading " + fileIndex + "/" + fileCount + " · " + file.name + " · " + Math.round(uploaded / file.size * 100) + "%");
      if (result.complete) break;
    }
  }

  async function uploadGoogleDriveFile() {
    const files = Array.from(googleDriveFileInput ? googleDriveFileInput.files : []);
    if (!files.length) { setDriveFilesStatus("Choose one or more files first.", true); return; }
    const invalid = files.find(file => !ALLOWED_TYPES.has(file.type) || !file.size || file.size > 2 * 1024 * 1024 * 1024);
    if (invalid) { setDriveFilesStatus("Every selected file must be a non-empty PDF, JPEG or PNG up to 2 GB. Invalid: " + invalid.name, true); return; }
    if (!googleDriveConnected || !currentPermissions.has("drive.write")) { setDriveFilesStatus("Your account does not have Google Drive upload permission.", true); return; }
    googleDriveUploadButton.disabled = true;
    googleDriveRefreshButton.disabled = true;
    let succeeded = 0;
    const failures = [];
    try {
      for (let index = 0; index < files.length; index++) {
        try { await uploadGoogleDriveSingleFile(files[index], index + 1, files.length); succeeded++; }
        catch (error) { failures.push(files[index].name + ": " + (error.message || "Upload failed")); }
      }
      googleDriveFileInput.value = "";
      await loadGoogleDriveFiles();
      if (failures.length) setDriveFilesStatus("Uploaded " + succeeded + " of " + files.length + " files. Failed: " + failures.join(" · "), true);
      else setDriveFilesStatus("Successfully uploaded " + succeeded + " file" + (succeeded === 1 ? "" : "s") + " to Google Drive.");
    } catch (error) { setDriveFilesStatus(error.message || "Google Drive upload failed.", true); }
    finally { googleDriveUploadButton.disabled = !googleDriveConnected; googleDriveRefreshButton.disabled = !googleDriveConnected; }
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

  function normalizeDocumentTags(value) {
    const tags = String(value || "").split(",").map(tag => tag.trim().replace(/\s+/g, " ")).filter(Boolean);
    const normalized = [];
    const seen = new Set();
    for (const tag of tags) {
      const key = tag.toLocaleLowerCase();
      if (tag.length > 32 || !/^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u.test(tag)) return null;
      if (!seen.has(key)) { seen.add(key); normalized.push(tag); }
    }
    return normalized.length <= 10 ? normalized : null;
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
    return storedName.replace(/^\d{10,}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "");
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
        published.set(file.name.slice(currentUserUid.length + 1), { category: file.category, tags: [] });
      }
    });
    const driveResponse = await googleDriveRequest("published-list");
    const drivePayload = await driveResponse.json();
    if (!driveResponse.ok) throw new Error(drivePayload.error || "Could not load published Drive files.");
    (drivePayload.documents || []).forEach(item => {
      if (item.drive_file_id) published.set(item.drive_file_id, { category: item.category, tags: Array.isArray(item.tags) ? item.tags : [] });
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
      let privateTags = new Map();
      let publishedFiles = new Map();
      let publishStatusWarning = "";
      try {
        const tagPayload = await privateVaultTagsRequest("private-tags-list");
        (tagPayload.documents || []).forEach(item => {
          if (typeof item.storage_path === "string" && Array.isArray(item.tags)) privateTags.set(item.storage_path, item.tags);
        });
      } catch (tagError) { publishStatusWarning += " Private tags could not be loaded: " + (tagError.message || "Access error"); }
      try { publishedFiles = await getPublishedFilesIndex(); }
      catch (publishError) { publishStatusWarning += " Published status could not be checked: " + (publishError.message || "Storage access error"); }
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

          li.dataset.storagePath = path;
          li.dataset.fileName = item.name;
          const actions = document.createElement("div");
          actions.className = "file-actions";
          const selectionLabel = document.createElement("label");
          selectionLabel.className = "bulk-file-select";
          const selection = document.createElement("input");
          selection.type = "checkbox";
          selection.className = "bulk-select-checkbox";
          selection.setAttribute("aria-label", "Select " + item.name);
          selectionLabel.append(selection);
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
          const publishedInfo = publishedFiles.get(item.name);
          const publishedCategory = publishedInfo && publishedInfo.category;
          li.dataset.publishedCategory = publishedCategory || "";
          if (publishedCategory) category.value = publishedCategory;
          const tagsInput = document.createElement("input");
          tagsInput.type = "text";
          tagsInput.className = "publish-tags";
          tagsInput.placeholder = "Tags: CTET, UP Police";
          tagsInput.maxLength = 320;
          tagsInput.setAttribute("aria-label", "Private document tags for " + item.name);
          tagsInput.value = (privateTags.get(path) || (publishedInfo && publishedInfo.tags) || []).join(", ");
          const saveTags = document.createElement("button");
          saveTags.type = "button";
          saveTags.className = "save-tags-button";
          saveTags.textContent = "Save tags";
          saveTags.title = "Save tags privately without publishing this document";
          saveTags.addEventListener("click", () => savePrivateDocumentTags(path, tagsInput.value, saveTags));
          saveTags.hidden = !currentPermissions.has("vault.write");
          const publish = document.createElement("button");
          publish.type = "button";
          publish.className = "publish-button";
          publish.textContent = publishedCategory ? "Republish" : "Publish";
          publish.addEventListener("click", () => publishFile(path, item.name, category.value, tagsInput.value, publish));
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
          selectionLabel.hidden = !(
            currentPermissions.has("vault.write") || currentPermissions.has("vault.publish") ||
            currentPermissions.has("vault.delete")
          );
          actions.append(selectionLabel, download, category, tagsInput, saveTags, publish, unpublish, remove);
          li.append(info, actions);
          fileList.append(li);
        });
      }
      const canBulkAct = currentPermissions.has("vault.write") || currentPermissions.has("vault.publish") || currentPermissions.has("vault.delete");
      if (bulkToolbar) bulkToolbar.hidden = !canBulkAct;
      if (bulkApplyTagsButton) bulkApplyTagsButton.hidden = !currentPermissions.has("vault.write");
      if (bulkPublishButton) bulkPublishButton.hidden = !currentPermissions.has("vault.publish");
      if (bulkUnpublishButton) bulkUnpublishButton.hidden = !currentPermissions.has("vault.publish");
      if (bulkDeleteButton) bulkDeleteButton.hidden = !currentPermissions.has("vault.delete");
      if (selectAllVaultFiles) selectAllVaultFiles.checked = false;
      applyVaultSearch();
      updateBulkSelectionUi();
      setVaultStatus(files.length + " private document(s) listed." + publishStatusWarning, Boolean(publishStatusWarning));
    } catch (error) {
      showEmpty("Could not load documents. Check the Storage policies and Firebase token.");
      setVaultStatus("Storage list failed: " + (error.message || "Unknown error"), true);
    } finally {
      refreshButton.disabled = false;
    }
  }

  function getSelectedVaultRows() {
    return Array.from(fileList.querySelectorAll("li.file-item")).filter(row =>
      row.querySelector(".bulk-select-checkbox")?.checked
    );
  }

  function updateBulkSelectionUi() {
    if (!bulkToolbar || !fileList) return;
    const rows = Array.from(fileList.querySelectorAll("li.file-item"));
    const selected = getSelectedVaultRows();
    if (bulkSelectionCount) bulkSelectionCount.textContent = selected.length + " selected";
    if (selectAllVaultFiles) {
      selectAllVaultFiles.checked = rows.length > 0 && selected.length === rows.length;
      selectAllVaultFiles.indeterminate = selected.length > 0 && selected.length < rows.length;
      selectAllVaultFiles.disabled = rows.length === 0;
    }
    [bulkApplyTagsButton, bulkPublishButton, bulkUnpublishButton, bulkDeleteButton].forEach(button => {
      if (button) button.disabled = selected.length === 0;
    });
  }

  async function applyBulkPrivateTags() {
    const rows = getSelectedVaultRows();
    if (!rows.length) return;
    if (!currentPermissions.has("vault.write")) { setVaultStatus("Your account cannot edit private document tags.", true); return; }
    const tags = normalizeDocumentTags(bulkTagsInput?.value || "");
    if (!tags) { setVaultStatus("Use up to 10 tags, each 1–32 characters, separated by commas.", true); return; }
    if (!window.confirm("Apply these private tags to " + rows.length + " selected document(s)?")) return;
    bulkApplyTagsButton.disabled = true;
    let saved = 0;
    const failures = [];
    try {
      for (const row of rows) {
        try {
          await privateVaultTagsRequest("private-tags-save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storagePath: row.dataset.storagePath, tags })
          });
          saved++;
          const rowTagsInput = row.querySelector(".publish-tags");
          if (rowTagsInput) rowTagsInput.value = tags.join(", ");
        } catch (error) { failures.push(row.dataset.fileName + ": " + (error.message || "Save failed")); }
      }
      setVaultStatus("Private tags applied to " + saved + "/" + rows.length + " document(s)." +
        (failures.length ? " Failed: " + failures.slice(0, 3).join("; ") : ""));
    } finally { bulkApplyTagsButton.disabled = false; }
  }

  async function publishSelectedVaultFiles() {
    const rows = getSelectedVaultRows();
    const category = bulkPublishCategory?.value || "";
    if (!rows.length) return;
    if (!currentPermissions.has("vault.publish")) { setVaultStatus("Your account cannot publish documents.", true); return; }
    if (!PUBLIC_CATEGORIES.includes(category)) { setVaultStatus("Choose a category for bulk publishing.", true); return; }
    const prepared = rows.map(row => ({ row, tags: normalizeDocumentTags(row.querySelector(".publish-tags")?.value || "") }));
    const invalid = prepared.find(item => !item.tags);
    if (invalid) { setVaultStatus("Invalid tags for " + invalid.row.dataset.fileName + ". Use up to 10 valid tags.", true); return; }
    if (!window.confirm("Publish " + rows.length + " selected document(s) publicly in " + category.replace(/-/g, " ") + "? Their private originals will remain in the vault.")) return;
    bulkPublishButton.disabled = true;
    let published = 0;
    const failures = [];
    try {
      for (const item of prepared) {
        const fileName = item.row.dataset.fileName;
        try {
          const { data, error: downloadError } = await supabaseClient.storage.from(BUCKET).download(item.row.dataset.storagePath);
          if (downloadError) throw downloadError;
          const publicPath = category + "/" + currentUserUid + "-" + fileName;
          const { error: uploadError } = await supabaseClient.storage.from(PUBLIC_BUCKET).upload(publicPath, data, {
            cacheControl: "60",
            contentType: data.type || "application/octet-stream",
            metadata: { tags: item.tags },
            upsert: true
          });
          if (uploadError) throw uploadError;
          published++;
        } catch (error) { failures.push(fileName + ": " + (error.message || "Publish failed")); }
      }
      setVaultStatus("Published " + published + "/" + rows.length + " document(s)." +
        (failures.length ? " Failed: " + failures.slice(0, 3).join("; ") : " Private originals remain unchanged."));
      await loadFiles();
    } finally { bulkPublishButton.disabled = false; }
  }

  async function unpublishSelectedVaultFiles() {
    const rows = getSelectedVaultRows();
    const publishedRows = rows.filter(row => row.dataset.publishedCategory);
    if (!publishedRows.length) { setVaultStatus("None of the selected documents are currently published.", true); return; }
    if (!currentPermissions.has("vault.publish")) { setVaultStatus("Your account cannot unpublish documents.", true); return; }
    if (!window.confirm("Unpublish " + publishedRows.length + " selected document(s)? Their private originals will remain in the vault.")) return;
    bulkUnpublishButton.disabled = true;
    let removed = 0;
    const failures = [];
    try {
      const byCategory = new Map();
      publishedRows.forEach(row => {
        const category = row.dataset.publishedCategory;
        if (!byCategory.has(category)) byCategory.set(category, []);
        byCategory.get(category).push(row);
      });
      for (const [category, group] of byCategory) {
        const paths = group.map(row => category + "/" + currentUserUid + "-" + row.dataset.fileName);
        try {
          const { error } = await supabaseClient.storage.from(PUBLIC_BUCKET).remove(paths);
          if (error) throw error;
          removed += group.length;
        } catch (error) { failures.push(category + ": " + (error.message || "Unpublish failed")); }
      }
      setVaultStatus("Unpublished " + removed + "/" + publishedRows.length + " document(s)." +
        (failures.length ? " Failed: " + failures.join("; ") : " Private originals remain unchanged."));
      await loadFiles();
    } finally { bulkUnpublishButton.disabled = false; }
  }

  async function deleteSelectedVaultFiles() {
    const rows = getSelectedVaultRows();
    if (!rows.length) return;
    if (!currentPermissions.has("vault.delete")) { setVaultStatus("Your account cannot delete documents.", true); return; }
    if (!window.confirm("Permanently delete " + rows.length + " selected private document(s)? This cannot be undone.")) return;
    bulkDeleteButton.disabled = true;
    let deleted = 0;
    const failures = [];
    try {
      for (let index = 0; index < rows.length; index += 100) {
        const batch = rows.slice(index, index + 100);
        const paths = batch.map(row => row.dataset.storagePath);
        const { error } = await supabaseClient.storage.from(BUCKET).remove(paths);
        if (error) {
          failures.push(...batch.map(row => row.dataset.fileName + ": " + error.message));
          continue;
        }
        deleted += batch.length;
        try {
          await privateVaultTagsRequest("private-tags-delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storagePaths: paths })
          });
        } catch (error) {
          failures.push("Private tag cleanup: " + (error.message || "Cleanup failed"));
        }
      }
      setVaultStatus("Deleted " + deleted + "/" + rows.length + " private document(s)." +
        (failures.length ? " Issues: " + failures.slice(0, 3).join("; ") : ""));
      await loadFiles();
    } catch (error) {
      setVaultStatus("Bulk delete stopped: " + (error.message || "Unknown error"), true);
      await loadFiles();
    } finally { bulkDeleteButton.disabled = false; }
  }

  async function privateVaultTagsRequest(action, options = {}) {
    const user = auth.currentUser;
    if (!user) throw new Error("Sign in is required to manage private document tags.");
    const headers = new Headers(options.headers || {});
    headers.set("apikey", SUPABASE_PUBLISHABLE_KEY);
    headers.set("Authorization", "Bearer " + await user.getIdToken());
    const endpoint = new URL(SUPABASE_URL + "/functions/v1/google-drive-files");
    endpoint.searchParams.set("action", action);
    const response = await fetch(endpoint.toString(), { method: options.method || "GET", headers, body: options.body });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Private document tags could not be saved.");
    return payload;
  }

  async function savePrivateDocumentTags(storagePath, tagsText, button) {
    const tags = normalizeDocumentTags(tagsText);
    if (!tags) { setVaultStatus("Use up to 10 tags, each 1–32 characters, separated by commas.", true); return; }
    if (!currentPermissions.has("vault.write")) { setVaultStatus("Your account does not have permission to edit private document tags.", true); return; }
    button.disabled = true;
    try {
      await privateVaultTagsRequest("private-tags-save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storagePath, tags }) });
      setVaultStatus(tags.length ? "Private tags saved. This document remains private." : "Private tags cleared. The document remains private.");
      button.textContent = "Saved";
    } catch (error) { setVaultStatus("Could not save private tags: " + (error.message || "Unknown error"), true); }
    finally { button.disabled = false; }
  }

  async function publishFile(privatePath, fileName, category, tagsText, button) {
    if (!category || !PUBLIC_CATEGORIES.includes(category)) {
      setVaultStatus("Choose a public category before publishing.", true);
      return;
    }
    const tags = normalizeDocumentTags(tagsText);
    if (!tags) { setVaultStatus("Use up to 10 tags, each 1–32 characters, separated by commas.", true); return; }
    if (!window.confirm("Publish this file publicly in " + category.replace(/-/g, " ") + "? Anyone with the public library link will be able to access it.")) return;
    button.disabled = true;
    try {
      const { data: downloaded, error: downloadError } = await supabaseClient.storage.from(BUCKET).download(privatePath);
      if (downloadError) throw downloadError;
      const publicPath = category + "/" + currentUserUid + "-" + fileName;
      const { error: uploadError } = await supabaseClient.storage.from(PUBLIC_BUCKET).upload(publicPath, downloaded, {
        cacheControl: "60",
        contentType: downloaded.type || "application/octet-stream",
        metadata: { tags },
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

  function uploadLargeFile(bucketName, objectPath, file, fileIndex = 1, fileCount = 1) {
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
            setVaultStatus("Uploading privately " + fileIndex + "/" + fileCount + " · " + file.name + " · " + percent + "% (" + formatBytes(bytesUploaded) + " / " + formatBytes(bytesTotal) + ")");
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
    const files = Array.from(fileInput.files || []);
    if (!files.length) { setVaultStatus("Choose one or more PDF, JPG or PNG files first.", true); return; }
    if (!auth.currentUser || !currentPermissions.has("vault.write")) { setVaultStatus("Your account does not have upload permission.", true); return; }
    if (!supabaseClient) { setVaultStatus("Storage SDK is unavailable. Refresh and try again.", true); return; }
    const invalid = files.find(file => !ALLOWED_TYPES.has(file.type) || file.size <= 0);
    if (invalid) { setVaultStatus("Every selected file must be a non-empty PDF, JPEG or PNG. Invalid: " + invalid.name, true); return; }
    if (!window.tus || typeof window.tus.Upload !== "function") { setVaultStatus("The resumable upload service could not load. Refresh and try again.", true); return; }
    uploadButton.disabled = true;
    uploadButton.textContent = "Checking existing files…";
    let succeeded = 0;
    const failures = [];
    const skipped = [];
    try {
      // Fail closed: refresh the private folder before uploading so a stale admin list
      // cannot hide an existing same-name document.
      const latestFiles = await listAllStorageFiles(BUCKET, currentUserUid);
      currentFiles = latestFiles;
      const existingNames = new Set(latestFiles.map(item =>
        safeFileName(displayFileName(item.name)).toLocaleLowerCase()
      ));
      const batchNames = new Set();
      const uploadable = [];
      files.forEach(file => {
        const key = safeFileName(file.name).toLocaleLowerCase();
        if (existingNames.has(key) || batchNames.has(key)) skipped.push(file.name);
        else { batchNames.add(key); uploadable.push(file); }
      });
      if (skipped.length) setVaultStatus("Overwrite protection: skipped existing/duplicate name(s): " + skipped.join(", "));
      for (let index = 0; index < uploadable.length; index++) {
        const file = uploadable[index];
        try {
          // A fresh UUID path plus non-upsert storage upload prevents replacing any object.
          const objectName = Date.now() + "-" + crypto.randomUUID() + "-" + safeFileName(file.name);
          await uploadLargeFile(BUCKET, currentUserUid + "/" + objectName, file, index + 1, uploadable.length);
          succeeded++;
        } catch (error) { failures.push(file.name + ": " + (error.message || "Upload failed")); }
      }
      fileInput.value = "";
      selectedFile.textContent = "No files selected";
      await loadFiles();
      const summary = "Uploaded " + succeeded + " of " + files.length + " selected file(s)." +
        (skipped.length ? " Skipped duplicates: " + skipped.join(", ") + "." : "");
      if (failures.length) setVaultStatus(summary + " Failed: " + failures.join(" · "), true);
      else setVaultStatus(summary + " No existing documents were overwritten.");
    } catch (error) { setVaultStatus("Upload batch stopped before completion: " + (error.message || "Could not verify existing files."), true); }
    finally { uploadButton.disabled = false; uploadButton.textContent = "Upload privately"; }
  });
  refreshButton.addEventListener("click", loadFiles);
  fileSearch.addEventListener("input", applyVaultSearch);
  if (bulkPublishCategory && bulkPublishCategory.options.length === 1) {
    PUBLIC_CATEGORIES.forEach(category => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category.replace(/-/g, " ");
      bulkPublishCategory.append(option);
    });
  }
  fileList.addEventListener("change", event => {
    if (event.target.matches(".bulk-select-checkbox")) updateBulkSelectionUi();
  });
  selectAllVaultFiles?.addEventListener("change", () => {
    fileList.querySelectorAll(".bulk-select-checkbox").forEach(input => { input.checked = selectAllVaultFiles.checked; });
    updateBulkSelectionUi();
  });
  bulkApplyTagsButton?.addEventListener("click", applyBulkPrivateTags);
  bulkPublishButton?.addEventListener("click", publishSelectedVaultFiles);
  bulkUnpublishButton?.addEventListener("click", unpublishSelectedVaultFiles);
  bulkDeleteButton?.addEventListener("click", deleteSelectedVaultFiles);

  fileInput.addEventListener("change", () => {
    const files = Array.from(fileInput.files || []);
    selectedFile.textContent = files.length ? files.length + " file(s) selected · " + files.map(file => file.name).join(", ") : "No files selected";
  });



  async function managementRequest(action, options = {}) {
    const user = auth.currentUser;
    if (!user) throw new Error("Please sign in again.");
    const headers = { "apikey": SUPABASE_PUBLISHABLE_KEY, "Authorization": "Bearer " + await user.getIdToken() };
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
    const headers = { "apikey": SUPABASE_PUBLISHABLE_KEY, "Authorization": "Bearer " + await user.getIdToken() };
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
      setChecked("setting-knowledge-enabled", values["home.knowledge.enabled"]);
      setChecked("setting-quiz-enabled", values["home.quiz.enabled"]);
      setChecked("setting-tools-enabled", values["home.tools.enabled"]);
      setChecked("setting-featured-enabled", values["home.featured.enabled"]);
      setChecked("setting-announcements-enabled", values["home.announcements.enabled"]);
      setChecked("setting-popular-enabled", values["home.popular.enabled"]);
      setChecked("setting-library-pdf-preview-enabled", values["home.library.pdf_preview_enabled"] !== false);
      setValue("setting-popular-max-items", values["home.popular.max_items"] ?? 6);
      setValue("setting-popular-min-views", values["home.popular.min_views"] ?? 1);
      setChecked("setting-popular-show-views", values["home.popular.show_views"] !== false);
      setChecked("setting-layout-enabled", values["home.layout.enabled"]);
      const layoutTextarea = document.getElementById("setting-layout-sections");
      if (layoutTextarea) layoutTextarea.value = JSON.stringify(Array.isArray(values["home.layout.sections"]) ? values["home.layout.sections"] : [{"id":"smart-document-search","enabled":true,"title":"","subtitle":""},{"id":"discover","enabled":true,"title":"","subtitle":""},{"id":"user-feedback","enabled":true,"title":"","subtitle":""},{"id":"learning-corner","enabled":true,"title":"","subtitle":""},{"id":"announcements","enabled":true,"title":"","subtitle":""},{"id":"featured-resources","enabled":true,"title":"","subtitle":""},{"id":"popular-resources","enabled":true,"title":"","subtitle":""},{"id":"quick-tools","enabled":true,"title":"","subtitle":""},{"id":"knowledge","enabled":true,"title":"","subtitle":""},{"id":"daily-quiz","enabled":true,"title":"","subtitle":""},{"id":"about","enabled":true,"title":"","subtitle":""},{"id":"contact","enabled":true,"title":"","subtitle":""}], null, 2);
      setChecked("setting-seo-enabled", values["home.seo.enabled"]);
      setValue("setting-seo-title", values["home.seo.default_title"] ?? "PixelForge — Digital resources and learning tools");
      setValue("setting-seo-description", values["home.seo.default_description"] ?? "Discover curated documents, study notes, digital tools and guided learning resources on PixelForge.");
      setValue("setting-seo-keywords", values["home.seo.default_keywords"] ?? "study notes, documents, learning resources, digital tools");
      setValue("setting-seo-canonical", values["home.seo.canonical_base"] ?? "");
      setValue("setting-seo-og-image", values["home.seo.og_image"] ?? "");
      const seoOverrides = document.getElementById("setting-seo-pages");
      if (seoOverrides) seoOverrides.value = JSON.stringify(Array.isArray(values["home.seo.page_overrides"]) ? values["home.seo.page_overrides"] : [], null, 2);
      setChecked("setting-feedback-enabled", values["home.feedback.enabled"]);
      setChecked("setting-feedback-anonymous", values["home.feedback.allow_anonymous"]);
      setChecked("setting-feedback-display", values["home.feedback.display_approved"]);
      setValue("setting-feedback-max-display", values["home.feedback.max_display"] ?? 6);
      const feedbackCategories = document.getElementById("setting-feedback-categories");
      if (feedbackCategories) feedbackCategories.value = (Array.isArray(values["home.feedback.categories"]) ? values["home.feedback.categories"] : ["General","Website","Resources","Suggestion"]).join("\n");
      setChecked("setting-learning-enabled", values["home.learning.enabled"]);
      const learningTextarea = document.getElementById("setting-learning-items");
      if (learningTextarea) learningTextarea.value = JSON.stringify(Array.isArray(values["home.learning.items"]) ? values["home.learning.items"] : [], null, 2);
      setChecked("setting-search-enabled", values["home.search.enabled"]);
      setChecked("setting-search-smart", values["home.search.smart_enabled"]);
      setChecked("setting-search-filters", values["home.search.filters_enabled"]);
      setValue("setting-search-max-results", values["home.search.max_results"] ?? 30);
      setValue("setting-search-placeholder", values["home.search.placeholder"] ?? "Search documents, notes and guides…");
      const announcementsTextarea = document.getElementById("setting-announcements-items");
      if (announcementsTextarea) announcementsTextarea.value = JSON.stringify(Array.isArray(values["home.announcements.items"]) ? values["home.announcements.items"] : [], null, 2);
      const featuredTextarea = document.getElementById("setting-featured-items");
      if (featuredTextarea) featuredTextarea.value = JSON.stringify(Array.isArray(values["home.featured.items"]) ? values["home.featured.items"] : [], null, 2);
      const toolsTextarea = document.getElementById("setting-tools-items");
      if (toolsTextarea) toolsTextarea.value = (Array.isArray(values["home.tools.items"]) ? values["home.tools.items"] : ["calculator","percentage","word-counter","unit-converter"]).join("\n");
      const quizTextarea = document.getElementById("setting-quiz-items");
      if (quizTextarea) quizTextarea.value = JSON.stringify(Array.isArray(values["home.quiz.items"]) ? values["home.quiz.items"] : [], null, 2);
      const knowledgeItems = Array.isArray(values["home.knowledge.items"]) ? values["home.knowledge.items"] : [];
      const knowledgeTextarea = document.getElementById("setting-knowledge-items");
      if (knowledgeTextarea) knowledgeTextarea.value = knowledgeItems.map(item =>
        String(item.category || "GENERAL") + " | " + String(item.text || "")
      ).join("\n");
      renderSettingsAudit(auditPayload.audit || []);
      loadFeedbackInbox();
      loadContactInbox();
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
    } else if (group === "home.knowledge") {
      const lines = document.getElementById("setting-knowledge-items").value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      const items = lines.map(line => {
        const split = line.indexOf("|");
        return split < 0 ? { category: "GENERAL", text: line } :
          { category: line.slice(0, split).trim().slice(0, 32), text: line.slice(split + 1).trim() };
      });
      if (items.length > 50 || items.some(item => item.text.length < 8 || item.text.length > 240)) {
        setSettingsStatus("Please add up to 50 facts, each 8–240 characters.", true);
        return;
      }
      saveSetting("home.knowledge.items", items, button)
        .then(() => saveSetting("home.knowledge.enabled", document.getElementById("setting-knowledge-enabled").checked, button));
    } else if (group === "home.library") {
      saveSetting("home.library.pdf_preview_enabled", document.getElementById("setting-library-pdf-preview-enabled").checked, button);
    } else if (group === "home.popular") {
      const maxItems = Number(document.getElementById("setting-popular-max-items").value);
      const minViews = Number(document.getElementById("setting-popular-min-views").value);
      if (!Number.isInteger(maxItems) || maxItems < 3 || maxItems > 12 ||
          !Number.isInteger(minViews) || minViews < 1 || minViews > 1000000) {
        setSettingsStatus("Choose 3–12 resources and a minimum open threshold from 1 to 1,000,000.", true); return;
      }
      saveSetting("home.popular.max_items", maxItems, button)
        .then(() => saveSetting("home.popular.min_views", minViews, button))
        .then(() => saveSetting("home.popular.show_views", document.getElementById("setting-popular-show-views").checked, button))
        .then(() => saveSetting("home.popular.enabled", document.getElementById("setting-popular-enabled").checked, button));
    } else if (group === "home.layout") {
      let sections;
      try { sections = JSON.parse(document.getElementById("setting-layout-sections").value || "[]"); }
      catch (_) { setSettingsStatus("Homepage layout must be valid JSON.", true); return; }
      const allowed = new Set(["smart-document-search","discover","user-feedback","learning-corner","announcements","featured-resources","popular-resources","quick-tools","knowledge","daily-quiz","about","contact"]);
      const valid = Array.isArray(sections) && sections.length === 12 && sections.every(item =>
        item && typeof item === "object" && !Array.isArray(item) &&
        Object.keys(item).every(key => ["id","enabled","title","subtitle"].includes(key)) &&
        typeof item.id === "string" && allowed.has(item.id) &&
        typeof item.enabled === "boolean" &&
        typeof item.title === "string" && item.title.length <= 80 &&
        typeof item.subtitle === "string" && item.subtitle.length <= 160
      );
      if (!valid || new Set(sections.map(item => item.id)).size !== 12) {
        setSettingsStatus("Keep all 12 allowed section IDs exactly once. Check visibility and heading values.", true); return;
      }
      saveSetting("home.layout.sections", sections, button)
        .then(() => saveSetting("home.layout.enabled", document.getElementById("setting-layout-enabled").checked, button));
    } else if (group === "home.seo") {
      const title = document.getElementById("setting-seo-title").value.trim();
      const description = document.getElementById("setting-seo-description").value.trim();
      const keywords = document.getElementById("setting-seo-keywords").value.trim();
      const canonical = document.getElementById("setting-seo-canonical").value.trim();
      const ogImage = document.getElementById("setting-seo-og-image").value.trim();
      let overrides;
      try { overrides = JSON.parse(document.getElementById("setting-seo-pages").value || "[]"); }
      catch (_) { setSettingsStatus("SEO page overrides must be valid JSON.", true); return; }
      const safeUrl = value => {
        if (!value) return true;
        try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
        catch (_) { return false; }
      };
      const validOverrides = Array.isArray(overrides) && overrides.length <= 20 && overrides.every(item =>
        item && typeof item === "object" && !Array.isArray(item) &&
        Object.keys(item).every(key => ["page","title","description","keywords","robots","canonical"].includes(key)) &&
        typeof item.page === "string" && /^\/[a-z0-9/._-]*$/i.test(item.page) && !item.page.includes("..") &&
        typeof item.title === "string" && item.title.trim().length >= 5 && item.title.length <= 70 &&
        typeof item.description === "string" && item.description.trim().length >= 50 && item.description.length <= 160 &&
        typeof item.keywords === "string" && item.keywords.length <= 250 &&
        ["index,follow","noindex,follow","noindex,nofollow"].includes(item.robots) &&
        typeof item.canonical === "string" && item.canonical.length <= 1200 && safeUrl(item.canonical)
      );
      if (title.length < 5 || title.length > 70 || description.length < 50 || description.length > 160 ||
          keywords.length > 250 || !safeUrl(canonical) || canonical.length > 300 || !safeUrl(ogImage) ||
          ogImage.length > 1200 || !validOverrides || new Set(overrides.map(item => item.page)).size !== overrides.length) {
        setSettingsStatus("Check SEO title/description lengths, HTTPS URLs and unique page override paths.", true); return;
      }
      saveSetting("home.seo.default_title", title, button)
        .then(() => saveSetting("home.seo.default_description", description, button))
        .then(() => saveSetting("home.seo.default_keywords", keywords, button))
        .then(() => saveSetting("home.seo.canonical_base", canonical, button))
        .then(() => saveSetting("home.seo.og_image", ogImage, button))
        .then(() => saveSetting("home.seo.page_overrides", overrides, button))
        .then(() => saveSetting("home.seo.enabled", document.getElementById("setting-seo-enabled").checked, button));
    } else if (group === "home.feedback") {
      const categories = document.getElementById("setting-feedback-categories").value.split(/\\r?\\n/).map(value => value.trim()).filter(Boolean);
      const maxDisplay = Number(document.getElementById("setting-feedback-max-display").value);
      if (!categories.length || categories.length > 8 || categories.some(value => value.length < 2 || value.length > 32) ||
          new Set(categories.map(value => value.toLowerCase())).size !== categories.length ||
          !Number.isInteger(maxDisplay) || maxDisplay < 1 || maxDisplay > 12) {
        setSettingsStatus("Add 1–8 unique categories (2–32 characters) and choose 1–12 approved comments to display.", true); return;
      }
      saveSetting("home.feedback.categories", categories, button)
        .then(() => saveSetting("home.feedback.allow_anonymous", document.getElementById("setting-feedback-anonymous").checked, button))
        .then(() => saveSetting("home.feedback.display_approved", document.getElementById("setting-feedback-display").checked, button))
        .then(() => saveSetting("home.feedback.max_display", maxDisplay, button))
        .then(() => saveSetting("home.feedback.enabled", document.getElementById("setting-feedback-enabled").checked, button));
    } else if (group === "home.learning") {
      let items;
      try { items = JSON.parse(document.getElementById("setting-learning-items").value || "[]"); }
      catch (_) { setSettingsStatus("Learning paths must be valid JSON.", true); return; }
      const valid = Array.isArray(items) && items.length <= 12 && items.every(path => {
        if (!path || typeof path !== "object" || Array.isArray(path) ||
            !Object.keys(path).every(key => ["id","title","description","topic","level","duration","published","steps"].includes(key)) ||
            typeof path.id !== "string" || !path.id.trim() || path.id.length > 64 ||
            typeof path.title !== "string" || !path.title.trim() || path.title.length > 100 ||
            typeof path.description !== "string" || !path.description.trim() || path.description.length > 240 ||
            typeof path.topic !== "string" || !path.topic.trim() || path.topic.length > 40 ||
            !["beginner","intermediate","advanced"].includes(path.level) ||
            typeof path.duration !== "string" || path.duration.length > 32 ||
            typeof path.published !== "boolean" || !Array.isArray(path.steps) || path.steps.length < 1 || path.steps.length > 8) return false;
        return path.steps.every(step => {
          if (!step || typeof step !== "object" || Array.isArray(step) ||
              !Object.keys(step).every(key => ["title","url"].includes(key)) ||
              typeof step.title !== "string" || !step.title.trim() || step.title.length > 100 ||
              typeof step.url !== "string" || step.url.length > 1200) return false;
          try { const url = new URL(step.url); return url.protocol === "https:" && !url.username && !url.password; }
          catch (_) { return false; }
        });
      });
      if (!valid || new Set(items.map(path => path.id)).size !== items.length) {
        setSettingsStatus("Add up to 12 valid paths with unique IDs and 1–8 HTTPS steps each.", true); return;
      }
      saveSetting("home.learning.items", items, button)
        .then(() => saveSetting("home.learning.enabled", document.getElementById("setting-learning-enabled").checked, button));
    } else if (group === "home.search") {
      const maxResults = Number(document.getElementById("setting-search-max-results").value);
      const placeholder = document.getElementById("setting-search-placeholder").value.trim();
      if (!Number.isInteger(maxResults) || maxResults < 6 || maxResults > 100 || placeholder.length < 5 || placeholder.length > 100) {
        setSettingsStatus("Results per page must be 6–100 and the placeholder must be 5–100 characters.", true); return;
      }
      saveSetting("home.search.enabled", document.getElementById("setting-search-enabled").checked, button)
        .then(() => saveSetting("home.search.smart_enabled", document.getElementById("setting-search-smart").checked, button))
        .then(() => saveSetting("home.search.filters_enabled", document.getElementById("setting-search-filters").checked, button))
        .then(() => saveSetting("home.search.max_results", maxResults, button))
        .then(() => saveSetting("home.search.placeholder", placeholder, button));
    } else if (group === "home.announcements") {
      let items;
      try { items = JSON.parse(document.getElementById("setting-announcements-items").value || "[]"); }
      catch (_) { setSettingsStatus("Announcements must be valid JSON.", true); return; }
      const valid = Array.isArray(items) && items.length <= 20 && items.every(item => {
        if (!item || typeof item !== "object" || Array.isArray(item) ||
            !Object.keys(item).every(key => ["id","title","message","type","startDate","endDate","published","url","label"].includes(key)) ||
            typeof item.id !== "string" || !item.id.trim() || item.id.length > 64 ||
            typeof item.title !== "string" || !item.title.trim() || item.title.length > 120 ||
            typeof item.message !== "string" || !item.message.trim() || item.message.length > 500 ||
            !["info","update","important"].includes(item.type) ||
            typeof item.startDate !== "string" || typeof item.endDate !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(item.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(item.endDate) ||
            Number.isNaN(Date.parse(item.startDate + "T00:00:00.000Z")) || Number.isNaN(Date.parse(item.endDate + "T00:00:00.000Z")) ||
            new Date(item.startDate + "T00:00:00.000Z").toISOString().slice(0, 10) !== item.startDate ||
            new Date(item.endDate + "T00:00:00.000Z").toISOString().slice(0, 10) !== item.endDate ||
            item.startDate > item.endDate || typeof item.published !== "boolean" ||
            typeof item.url !== "string" || item.url.length > 1200 ||
            typeof item.label !== "string" || item.label.length > 32) return false;
        if (!item.url) return item.label === "";
        try { const url = new URL(item.url); return url.protocol === "https:" && !url.username && !url.password && item.label.trim().length > 0; }
        catch (_) { return false; }
      });
      if (!valid || new Set(items.map(item => item.id)).size !== items.length) {
        setSettingsStatus("Add up to 20 valid announcements with unique IDs and valid dates.", true); return;
      }
      saveSetting("home.announcements.items", items, button)
        .then(() => saveSetting("home.announcements.enabled", document.getElementById("setting-announcements-enabled").checked, button));
    } else if (group === "home.featured") {
      let items;
      try { items = JSON.parse(document.getElementById("setting-featured-items").value || "[]"); }
      catch (_) { setSettingsStatus("Featured resources must be valid JSON.", true); return; }
      const valid = Array.isArray(items) && items.length <= 12 && items.every(item => {
        if (!item || typeof item !== "object" || Array.isArray(item) ||
            !Object.keys(item).every(key => ["id","title","description","category","url","label","published"].includes(key)) ||
            typeof item.id !== "string" || !item.id.trim() || item.id.length > 64 ||
            typeof item.title !== "string" || !item.title.trim() || item.title.length > 100 ||
            typeof item.description !== "string" || item.description.length > 240 ||
            typeof item.category !== "string" || !item.category.trim() || item.category.length > 40 ||
            typeof item.url !== "string" || item.url.length > 1200 ||
            typeof item.label !== "string" || !item.label.trim() || item.label.length > 32 ||
            typeof item.published !== "boolean") return false;
        try { const url = new URL(item.url); return url.protocol === "https:" && !url.username && !url.password; }
        catch (_) { return false; }
      });
      if (!valid || new Set(items.map(item => item.id)).size !== items.length) {
        setSettingsStatus("Add up to 12 valid resources with unique IDs and HTTPS links.", true); return;
      }
      saveSetting("home.featured.items", items, button)
        .then(() => saveSetting("home.featured.enabled", document.getElementById("setting-featured-enabled").checked, button));
    } else if (group === "home.tools") {
      const items = document.getElementById("setting-tools-items").value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
      const allowed = new Set(["calculator","percentage","word-counter","unit-converter"]);
      if (items.length > 4 || items.some(item => !allowed.has(item)) || new Set(items).size !== items.length) {
        setSettingsStatus("Choose each allowed tool at most once. Keep the list to four tools.", true); return;
      }
      saveSetting("home.tools.items", items, button)
        .then(() => saveSetting("home.tools.enabled", document.getElementById("setting-tools-enabled").checked, button));
    } else if (group === "home.quiz") {
      let items;
      try { items = JSON.parse(document.getElementById("setting-quiz-items").value || "[]"); }
      catch (_) { setSettingsStatus("Quiz questions must be valid JSON.", true); return; }
      const valid = Array.isArray(items) && items.length <= 100 && items.every(item =>
        item && typeof item === "object" && !Array.isArray(item) &&
        Object.keys(item).every(key => ["id","category","publishDate","published","question","options","correctIndex","explanation"].includes(key)) &&
        typeof item.id === "string" && item.id.trim().length > 0 && item.id.length <= 80 &&
        typeof item.category === "string" && item.category.trim().length > 0 && item.category.length <= 32 &&
        /^\d{4}-\d{2}-\d{2}$/.test(item.publishDate) && !Number.isNaN(Date.parse(item.publishDate + "T00:00:00.000Z")) && new Date(item.publishDate + "T00:00:00.000Z").toISOString().slice(0, 10) === item.publishDate &&
        typeof item.published === "boolean" &&
        typeof item.question === "string" && item.question.trim().length >= 10 && item.question.length <= 500 &&
        Array.isArray(item.options) && item.options.length === 4 &&
        item.options.every(option => typeof option === "string" && option.trim().length > 0 && option.length <= 160) &&
        Number.isInteger(item.correctIndex) && item.correctIndex >= 0 && item.correctIndex <= 3 &&
        typeof item.explanation === "string" && item.explanation.length <= 1000
      );
      if (!valid) {
        setSettingsStatus("Each quiz question needs valid fields, four options and correctIndex 0–3. Maximum 100 questions.", true);
        return;
      }
      saveSetting("home.quiz.items", items, button)
        .then(() => saveSetting("home.quiz.enabled", document.getElementById("setting-quiz-enabled").checked, button));
    }
  }));
  if (refreshSettingsButton) refreshSettingsButton.addEventListener("click", loadSettings);

  async function loadOverviewAnalytics() {
    if (!currentPermissions.has("analytics.view") || !auth.currentUser || !overviewPageViewsStat) return;
    overviewPageViewsStat.textContent = "…";
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(SUPABASE_URL + "/functions/v1/analytics?action=summary&days=7", {
        headers: { "apikey": SUPABASE_PUBLISHABLE_KEY, "Authorization": "Bearer " + token }
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
        headers: { "apikey": SUPABASE_PUBLISHABLE_KEY, "Authorization": "Bearer " + token }
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
    const headers = { "apikey": SUPABASE_PUBLISHABLE_KEY, "Authorization": "Bearer " + await user.getIdToken() };
    if (options.body) headers["Content-Type"] = "application/json";
    const response = await fetch(SUPABASE_URL + "/functions/v1/analytics?action=" + encodeURIComponent(action), {
      method: options.method || "GET", headers, body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const diagnostic = payload.diagnostic ? " (" + String(payload.diagnostic).slice(0, 240) + ")" : "";
      throw new Error((payload.error || "Security logs request failed.") + diagnostic);
    }
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
        cell.colSpan = 8; cell.className = "empty-state"; cell.textContent = "No security logs recorded yet.";
        row.append(cell); securityLogsBody.append(row);
      } else {
        payload.logs.forEach(log => {
          const row = document.createElement("tr");
          [log.ipAddress, log.ipAddress && log.ipAddress.includes(":") ? "IPv6" : "IPv4", log.ipSource === "supabase-edge-cf-connecting-ip" ? "Supabase trusted edge" : log.ipSource === "unavailable" ? "Hosting IP unavailable" : log.ipSource === "cf-connecting-ip" ? "Legacy edge IP" : "Unknown / legacy", (log.localIpAddress ? log.localIpAddress + " (browser-reported)" : "Not shared"), (Number.isFinite(log.latitude) && Number.isFinite(log.longitude) ? log.latitude.toFixed(5) + ", " + log.longitude.toFixed(5) + " · ±" + Math.round(log.locationAccuracyM || 0) + " m" : "Not shared"), log.eventType, log.pagePath, new Date(log.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }) + " IST"].forEach(value => {
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


  async function loadFeedbackInbox() {
    const container = document.getElementById("feedback-inbox-list");
    const status = document.getElementById("feedback-inbox-status");
    if (!container || !currentPermissions.has("settings.view")) return;
    try {
      const payload = await settingsRequest("feedback-list");
      container.replaceChildren();
      const entries = Array.isArray(payload.feedback) ? payload.feedback : [];
      if (!entries.length) {
        const empty = document.createElement("p"); empty.className = "empty-state"; empty.textContent = "No feedback submissions yet."; container.append(empty);
      } else {
        entries.forEach(item => {
          const card = document.createElement("article"); card.className = "feedback-inbox-card";
          const heading = document.createElement("div"); heading.className = "feedback-inbox-heading";
          const title = document.createElement("strong"); title.textContent = (item.name || "Anonymous") + " · " + item.category;
          const meta = document.createElement("span"); meta.textContent = "★".repeat(Number(item.rating) || 0) + " · " + item.status;
          heading.append(title, meta);
          const message = document.createElement("p"); message.textContent = item.message;
          const date = document.createElement("small"); date.textContent = item.created_at ? new Date(item.created_at).toLocaleString() : "";
          card.append(heading, message, date);
          if (item.status === "pending" && currentPermissions.has("settings.manage")) {
            const actions = document.createElement("div"); actions.className = "feedback-inbox-actions";
            ["approved","rejected"].forEach(nextStatus => {
              const button = document.createElement("button"); button.type = "button"; button.textContent = nextStatus === "approved" ? "Approve" : "Reject";
              button.dataset.feedbackAction = nextStatus; button.dataset.feedbackId = item.id;
              actions.append(button);
            });
            card.append(actions);
          }
          container.append(card);
        });
      }
      if (status) status.textContent = entries.length + " recent submission(s).";
    } catch (error) { if (status) status.textContent = error.message || "Could not load feedback inbox."; }
  }
  async function loadContactInbox() {
    const container=document.getElementById("contact-inbox-list"), status=document.getElementById("contact-inbox-status");
    if(!container||!currentPermissions.has("settings.view"))return;
    try {
      const payload=await settingsRequest("contact-list"), entries=Array.isArray(payload.messages)?payload.messages:[]; container.replaceChildren();
      if(!entries.length){const empty=document.createElement("p");empty.className="empty-state";empty.textContent="No contact messages yet.";container.append(empty);}
      else entries.forEach(item=>{
        const card=document.createElement("article");card.className="feedback-inbox-card";
        const heading=document.createElement("div");heading.className="feedback-inbox-heading";
        const title=document.createElement("strong");title.textContent=item.subject||"(No subject)";
        const meta=document.createElement("span");meta.textContent=item.status==="new"?"NEW":String(item.status||"").toUpperCase();heading.append(title,meta);
        const sender=document.createElement("p");sender.textContent=(item.name||"Visitor")+" · "+(item.email||"");
        const message=document.createElement("p");message.textContent=item.message||"";
        const date=document.createElement("small");date.textContent=item.created_at?new Date(item.created_at).toLocaleString():"";card.append(heading,sender,message,date);
        const actions=document.createElement("div");actions.className="feedback-inbox-actions";
        const reply=document.createElement("a");reply.className="button button-small";reply.textContent="Reply by email";reply.href="mailto:"+encodeURIComponent(item.email||"")+"?subject="+encodeURIComponent("Re: "+(item.subject||"Your message"));actions.append(reply);
        if(item.status!=="archived"&&currentPermissions.has("settings.manage")){const next=item.status==="new"?"read":"archived";const button=document.createElement("button");button.type="button";button.textContent=next==="read"?"Mark as read":"Archive";button.dataset.contactAction=next;button.dataset.contactId=item.id;actions.append(button);}
        card.append(actions);container.append(card);
      });
      if(status)status.textContent=entries.length+" message(s), newest first.";
    }catch(error){if(status)status.textContent=error.message||"Could not load contact messages.";}
  }
  document.getElementById("refresh-contact-messages")?.addEventListener("click",loadContactInbox);
  document.getElementById("contact-inbox-list")?.addEventListener("click",async event=>{
    const button=event.target.closest("[data-contact-action]");if(!button)return;button.disabled=true;
    try{await settingsRequest("contact-status",{method:"POST",body:{id:button.dataset.contactId,status:button.dataset.contactAction}});await loadContactInbox();}
    catch(error){setSettingsStatus(error.message||"Could not update contact message.",true);button.disabled=false;}
  });
  document.getElementById("refresh-feedback")?.addEventListener("click", loadFeedbackInbox);
  document.getElementById("feedback-inbox-list")?.addEventListener("click", async event => {
    const button = event.target.closest("[data-feedback-action]");
    if (!button) return;
    button.disabled = true;
    try {
      await settingsRequest("feedback-moderate", { method: "POST", body: { id: button.dataset.feedbackId, status: button.dataset.feedbackAction } });
      await loadFeedbackInbox();
    } catch (error) { setSettingsStatus(error.message || "Could not moderate feedback.", true); button.disabled = false; }
  });

})();
