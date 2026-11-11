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
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

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
  const countLabel = document.getElementById("file-count-label");
  let currentFiles = [];

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
      fileList.replaceChildren();
      updateStats();
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
    if (!Number.isFinite(bytes)) return "";
    return bytes < 1024 * 1024
      ? Math.max(1, Math.round(bytes / 1024)) + " KB"
      : (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function updateStats(files) {
    const bytes = files.reduce((sum, file) => sum + Number(file.metadata && file.metadata.size || 0), 0);
    countStat.textContent = String(files.length);
    storageStat.textContent = bytes < 1048576 ? Math.max(1, Math.round(bytes / 1024)) + " KB" : (bytes / 1048576).toFixed(2) + " MB";
    countLabel.textContent = files.length + (files.length === 1 ? " file" : " files");
  }

  function showEmpty(message) {
    const item = document.createElement("li");
    item.className = "empty-state";
    item.textContent = message;
    fileList.replaceChildren(item);
  }

  async function loadFiles() {
    if (!supabaseClient || !auth.currentUser || auth.currentUser.uid !== ADMIN_UID) return;
    refreshButton.disabled = true;
    setVaultStatus("Loading private documents…");
    try {
      const { data, error } = await supabaseClient.storage
        .from(BUCKET)
        .list(ADMIN_UID, {
          limit: 100,
          offset: 0,
          sortBy: { column: "created_at", order: "desc" }
        });
      if (error) throw error;
      const files = (data || []).filter(item => item.name && !item.name.endsWith("/"));
      currentFiles = files;
      updateStats(files);
      if (!files.length) {
        showEmpty("No documents uploaded yet.");
      } else {
        fileList.replaceChildren();
        files.forEach(item => {
          const path = ADMIN_UID + "/" + item.name;
          const li = document.createElement("li");
          li.className = "file-item";
          const info = document.createElement("div");
          info.className = "file-info";
          const name = document.createElement("div");
          name.className = "file-name";
          name.textContent = item.name;
          const meta = document.createElement("div");
          meta.className = "file-meta";
          const size = item.metadata && item.metadata.size ? formatBytes(Number(item.metadata.size)) : "Stored privately";
          meta.textContent = size;
          info.append(name, meta);

          const actions = document.createElement("div");
          actions.className = "file-actions";
          const download = document.createElement("button");
          download.type = "button";
          download.textContent = "Download";
          download.addEventListener("click", () => downloadFile(path, item.name, download));
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "delete-button";
          remove.textContent = "Delete";
          remove.addEventListener("click", () => deleteFile(path, li, remove));
          actions.append(download, remove);
          li.append(info, actions);
          fileList.append(li);
        });
      }
      setVaultStatus(files.length + " private document(s) listed.");
    } catch (error) {
      showEmpty("Could not load documents. Check the Storage policies and Firebase token.");
      setVaultStatus("Storage list failed: " + (error.message || "Unknown error"), true);
    } finally {
      refreshButton.disabled = false;
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
      listItem.remove();
      if (!fileList.children.length) showEmpty("No documents uploaded yet.");
      setVaultStatus("Document deleted.");
    } catch (error) {
      setVaultStatus("Delete failed: " + (error.message || "Unknown error"), true);
      button.disabled = false;
    }
  }

  uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      setVaultStatus("Choose a PDF, JPG or PNG file first.", true);
      return;
    }
    if (!auth.currentUser || auth.currentUser.uid !== ADMIN_UID) {
      setVaultStatus("Admin session is not valid. Sign in again.", true);
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
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      setVaultStatus("File must be larger than 0 bytes and no bigger than 10 MB.", true);
      return;
    }

    uploadButton.disabled = true;
    uploadButton.textContent = "Uploading…";
    setVaultStatus("Uploading privately…");
    try {
      const objectName = Date.now() + "-" + crypto.randomUUID() + "-" + safeFileName(file.name);
      const objectPath = ADMIN_UID + "/" + objectName;
      const { error } = await supabaseClient.storage
        .from(BUCKET)
        .upload(objectPath, file, {
          cacheControl: "0",
          contentType: file.type,
          upsert: false
        });
      if (error) throw error;
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
  fileSearch.addEventListener("input", () => {
    const query = fileSearch.value.trim().toLowerCase();
    Array.from(fileList.children).forEach(item => {
      item.hidden = query && !item.textContent.toLowerCase().includes(query);
    });
  });

  fileInput.addEventListener("change", () => {
    selectedFile.textContent = fileInput.files && fileInput.files[0]
      ? fileInput.files[0].name + " · " + formatBytes(fileInput.files[0].size)
      : "No file selected";
  });



  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      showAdminSession(false);
      return;
    }
    if (user.uid === ADMIN_UID) {
      showAdminSession(true);
      return;
    }
    showAdminSession(false);
    status.textContent = "This account is not authorized for PixelForge administration.";
    try { await auth.signOut(); } catch (_) {}
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
      if (credential.user.uid !== ADMIN_UID) {
        await auth.signOut();
        status.textContent = "This account is not authorized for PixelForge administration.";
      }
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
