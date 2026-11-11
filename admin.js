(() => {
  const firebaseConfig = {
    apiKey: "AIzaSyCkOkyOUqbwBRDPCxg2wUcbZp3sL3Y-1B4",
    authDomain: "pixelforge-66f0c.firebaseapp.com",
    projectId: "pixelforge-66f0c",
    storageBucket: "pixelforge-66f0c.firebasestorage.app",
    messagingSenderId: "133621997508",
    appId: "1:133621997508:web:2d92b52b7ff46b4552ce91",
    measurementId: "G-C22G53L12V"
  };

  const ADMIN_UID = "5PcOkyDEcNc1puSeB2lQ6dLFVOF2";
  const SUPABASE_URL = "https://zeueivmdzhkhonkyllij.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_sTs9Niej0BbWOw1vITV_jA_utoWwsw3";
  const form = document.getElementById("login-form");
  const loginButton = document.getElementById("login-button");
  const logoutButton = document.getElementById("logout-button");
  const status = document.getElementById("status");
  const sessionPanel = document.getElementById("admin-session");

  if (!window.firebase || !form || !loginButton || !logoutButton || !status || !sessionPanel) {
    if (status) status.textContent = "The sign-in service could not be loaded. Refresh and try again.";
    return;
  }

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    status.textContent = "The secure storage service could not be loaded. Refresh and try again.";
    return;
  }
  // Firebase remains the identity provider. Supabase validates this Firebase ID token
  // through its configured Firebase third-party authentication integration.
  const supabaseClient = window.supabase.createClient(
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

  function showAdminSession(isAdmin) {
    form.hidden = isAdmin;
    sessionPanel.hidden = !isAdmin;
    status.textContent = "";
  }

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
      status.textContent = safeMessages[error.code] || "Sign-in failed. Check your details and try again.";
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