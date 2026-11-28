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
  const $ = id => document.getElementById(id);
  const status = $("student-status");
  if (!window.firebase) { if(status) status.textContent="Sign-in service did not load. Refresh and try again."; return; }
  if (!firebase.apps.length) firebase.initializeApp(config);
  const auth = firebase.auth();
  async function api(action, method="GET", body) {
    const user=auth.currentUser;
    if(!user) throw new Error("Please sign in again.");
    const headers={"apikey":KEY,"Authorization":"Bearer "+await user.getIdToken()};
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
    event.preventDefault(); const button=signup.querySelector("button");button.disabled=true;status.textContent="Creating your account…";
    let created=null;
    try {
      const name=$("student-name").value.trim(),email=$("student-email").value.trim().toLowerCase(),password=$("student-password").value;
      if(name.length<2) throw new Error("Enter your full name (at least 2 characters).");
      const credential=await auth.createUserWithEmailAndPassword(email,password);created=credential.user;
      await api("student-register","POST",{full_name:name});
      window.location.assign("dashboard.html");
    } catch(error) {
      status.textContent=error.code==="auth/email-already-in-use"?"This email is already registered. Please sign in.":error.message||"Signup failed.";
      if(created) status.textContent += " Your login may have been created; try signing in to finish profile setup.";
    } finally {button.disabled=false;}
  });
  if(login) login.addEventListener("submit",async event=>{
    event.preventDefault();const button=login.querySelector("button");button.disabled=true;status.textContent="Signing in…";
    try {
      await auth.signInWithEmailAndPassword($("student-email").value.trim().toLowerCase(),$("student-password").value);
      await api("student-session");window.location.assign("dashboard.html");
    } catch(error) {
      status.textContent=error.code==="auth/invalid-credential"?"Email or password is incorrect.":error.message||"Sign-in failed.";
    } finally {button.disabled=false;}
  });
  if(dashboard) {
    auth.onAuthStateChanged(async user=>{
      if(!user){window.location.replace("login.html");return;}
      try {
        const payload=await api("student-session");const student=payload.student;
        $("student-name-display").textContent=student.full_name;
        $("student-email-display").textContent=student.email;
        $("student-created-display").textContent=new Date(student.created_at).toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric"});
        dashboard.hidden=false;
      } catch(error) {status.textContent=error.message||"Could not load student profile.";await auth.signOut();}
    });
    $("student-logout").addEventListener("click",async()=>{await auth.signOut();window.location.replace("login.html");});
  }
})();