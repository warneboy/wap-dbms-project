
// Banner carousel
const bannerTrack = document.getElementById("bannerTrack");
const totalSlides = bannerTrack.children.length;
let index = 0;
function updateSlide(){ bannerTrack.style.transform=`translateX(-${index*100}%)`; }
function nextSlide(){ index=(index+1)%totalSlides; updateSlide(); }
function prevSlide(){ index=(index-1+totalSlides)%totalSlides; updateSlide(); }
setInterval(nextSlide,4000);

// Login modal
function openLogin(){ document.getElementById("loginPopup").style.display="flex"; }
function closeLogin(){ document.getElementById("loginPopup").style.display="none"; }

// Signup modal
function openSignup(){ document.getElementById("signupPopup").style.display="flex"; }
function closeSignup(){ document.getElementById("signupPopup").style.display="none"; }

// Switch between login and signup
function switchToSignup(){ closeLogin(); openSignup(); }

// Shopkeeper fields
const role = document.getElementById("role");
const shopFields = document.querySelectorAll(".shopkeeper-only");
function toggleFields(){ shopFields.forEach(el=>el.style.display=role.value==="shopkeeper"?"block":"none"); }
toggleFields();
role.addEventListener("change", toggleFields);

// Password validation
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirm_password");
const errorMsg = document.getElementById("errorMsg");
const successMsg = document.getElementById("successMsg");
function validatePassword(){
  if(confirmPassword.value==="") return true;
  if(password.value!==confirmPassword.value){ confirmPassword.classList.add("error"); errorMsg.textContent="Passwords do not match"; return false; }
  confirmPassword.classList.remove("error"); errorMsg.textContent=""; return true;
}
password.addEventListener("input",validatePassword);
confirmPassword.addEventListener("input",validatePassword);

// Submit signup
document.getElementById("signupForm").addEventListener("submit", async e=>{
  e.preventDefault(); errorMsg.textContent=""; successMsg.textContent="";
  if(!validatePassword()) return;
  try{
    const res=await fetch("/signup",{method:"POST", body:new FormData(e.target)});
    const data=await res.json();
    if(!res.ok){ errorMsg.textContent=data.message; return; }
    successMsg.textContent="🎉 Registered successfully! Redirecting...";
    setTimeout(()=>{ closeSignup(); openLogin(); },2000);
  }catch{ errorMsg.textContent="Server error. Try again."; }
});

// Submit login
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
loginForm.addEventListener("submit", async e=>{
  e.preventDefault(); loginError.textContent="";
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  try{
    const res = await fetch("/login",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email,password})});
    const data = await res.json();
    if(!res.ok){ loginError.textContent=data.message; return; }
    localStorage.setItem("token", data.token);
    localStorage.setItem("role", data.role);
    alert(`Login successful as ${data.role}`);
    closeLogin();
  }catch{ loginError.textContent="Server error. Try again."; }
});
