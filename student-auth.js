(() => {
  const config = {
    apiKey: "AIzaSyCkQReOUqbwBRDPCxg2wUcbZp3sL3Y-1B4",
    authDomain: "pixelforge-66f0c.firebaseapp.com",
    projectId: "pixelforge-66f0c",
    storageBucket: "pixelforge-66f0c.firebasestorage.app",
    messagingSenderId: "133621997508",
    appId: "1:133621997508:web:2d92b52b7ff46b4552ce91"
  };
  const API = "https://zeueivmdzhkhonkyllij.supabase.co/functions/v1/user-management";
  const KEY = "sb_publishable_sTs9Niej0BbWOw1vITV_jA_utoWwsw3";
  // Replace with the Cloudflare Turnstile site key for pixelforge.jo3.org.
  const TURNSTILE_SITE_KEY = "YOUR_CLOUDFLARE_TURNSTILE_SITE_KEY";
  const $ = id => document.getElementById(id);
  const status = $("student-status");
  if (!window.firebase) { if(status) status.textContent="Sign-in service did not load. Refresh and try again."; return; }
  if (!firebase.apps.length) firebase.initializeApp(config);
  const auth = firebase.auth();
  let captchaToken = "";
  let captchaWidget = null;
  const captchaConfigured = TURNSTILE_SITE_KEY !== "YOUR_CLOUDFLARE_TURNSTILE_SITE_KEY";
  window.onStudentTurnstileReady = () => {
    const target=$("student-turnstile");
    if(!target) return;
    if(!captchaConfigured){ if(status) status.textContent="Signup security is being configured. Registration is temporarily unavailable."; return; }
    captchaWidget=window.turnstile.render(target,{
      sitekey:TURNSTILE_SITE_KEY,
      callback:token=>{captchaToken=token;if(status)status.textContent="Anti-bot check passed. Continue."},
      "expired-callback":()=>{captchaToken="";if(status)status.textContent="Verification expired. Please complete it again."},
      "error-callback":()=>{captchaToken="";if(status)status.textContent="Anti-bot verification failed. Reload and try again."}
    });
  };
  async function api(action, method="GET", body, authenticated=true) {
    const headers={"apikey":KEY};
    if(authenticated){
      const user=auth.currentUser;
      if(!user) throw new Error("Please sign in again.");
      headers.Authorization="Bearer "+await user.getIdToken(true);
    }
    if(body) headers["Content-Type"]="application/json";
    const response=await fetch(API+"?action="+encodeURIComponent(action),{method,headers,body:body?JSON.stringify(body):undefined,credentials:"omit"});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(payload.error||"Request failed.");
    return payload;
  }
  const signup=$("student-signup-form");
  const login=$("student-login-form");
  const dashboard=$("student-dashboard");
  if(signup) signup.addEventListener("submit",async event=>{
    event.preventDefault(); const button=signup.querySelector("button");button.disabled=true;status.textContent="Checking signup security…";
    let created=null;
    try {
      if(!captchaConfigured || !captchaToken) throw new Error("Complete the anti-bot verification first.");
      const name=$("student-name").value.trim(),email=$("student-email").value.trim().toLowerCase(),password=$("student-password").value;
      if(name.length<2) throw new Error("Enter your full name (at least 2 characters).");
      await api("student-signup-preflight","POST",{email,turnstile_token:captchaToken,website:$("student-website")?.value||""},false);
      captchaToken="";
      const credential=await auth.createUserWithEmailAndPassword(email,password);created=credential.user;
      await credential.user.updateProfile({displayName:name});
      await credential.user.sendEmailVerification({url:window.location.origin+"/login.html",handleCodeInApp:false});
      await auth.signOut();
      status.textContent="Account created. Check your email and verify your address before signing in. Check Spam/Junk if the email is missing.";
      signup.reset();
      if(window.turnstile&&captchaWidget!==null)window.turnstile.reset(captchaWidget);
    } catch(error) {
      status.textContent=error.code==="auth/email-already-in-use"?"This email is already registered. Please sign in.":error.message||"Signup failed.";
      if(created) status.textContent+=" Your Firebase login was created. Verify your email, then sign in to finish registration.";
      if(window.turnstile&&captchaWidget!==null)window.turnstile.reset(captchaWidget);
    } finally {button.disabled=false;}
  });
  if(login) login.addEventListener("submit",async event=>{
    event.preventDefault();const button=login.querySelector("button");button.disabled=true;status.textContent="Signing in…";
    try {
      const credential=await auth.signInWithEmailAndPassword($("student-email").value.trim().toLowerCase(),$("student-password").value);
      await credential.user.reload();
      const user=auth.currentUser;
      if(!user.emailVerified){
        await user.sendEmailVerification({url:window.location.origin+"/login.html",handleCodeInApp:false});
        await auth.signOut();
        throw new Error("Email verification is still pending. We sent a fresh verification link; verify it before signing in.");
      }
      const payload=await api("student-register","POST",{full_name:user.displayName||"",turnstile_token:captchaToken,website:$("student-website")?.value||""});
      if(payload.student.status!=="active")throw new Error("This student account is suspended.");
      window.location.assign("dashboard.html");
    } catch(error) {
      status.textContent=error.code==="auth/invalid-credential"?"Email or password is incorrect.":error.message||"Sign-in failed.";
      if(window.turnstile&&captchaWidget!==null)window.turnstile.reset(captchaWidget);
      captchaToken="";
      if(auth.currentUser && !auth.currentUser.emailVerified) await auth.signOut();
    } finally {button.disabled=false;}
  });
  if(dashboard) {
    auth.onAuthStateChanged(async user=>{
      if(!user){window.location.replace("login.html");return;}
      try {
        await user.reload();
        if(!auth.currentUser.emailVerified) throw new Error("Verify your email address before opening the dashboard.");
        const payload=await api("student-session");const student=payload.student;
        $("student-name-display").textContent=student.full_name;
        if($("student-name-display-copy")) $("student-name-display-copy").textContent=student.full_name;
        $("student-email-display").textContent=student.email;
        $("student-created-display").textContent=new Date(student.created_at).toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric"});
        dashboard.hidden=false;
      } catch(error) {status.textContent=error.message||"Could not load student profile.";await auth.signOut();}
    });
    $("student-logout").addEventListener("click",async()=>{await auth.signOut();window.location.replace("login.html");});
  }
})();