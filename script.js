// ======================= BANNER CAROUSEL =======================
const bannerTrack = document.getElementById("bannerTrack");
const totalSlides = bannerTrack ? bannerTrack.children.length : 0;
let index = 0;

function updateSlide() {
  if (!bannerTrack) return;
  bannerTrack.style.transform = `translateX(-${index * 100}%)`;
}

function nextSlide() {
  index = (index + 1) % totalSlides;
  updateSlide();
}

function prevSlide() {
  index = (index - 1 + totalSlides) % totalSlides;
  updateSlide();
}

if (totalSlides > 0) setInterval(nextSlide, 4000);

// ======================= MODAL CONTROLS =======================
function openLogin() {
  document.getElementById("loginPopup").style.display = "flex";
}

function closeLogin() {
  const loginPopup = document.getElementById("loginPopup");
  loginPopup.style.display = "none";
  document.getElementById("loginForm").reset();
  document.getElementById("loginError").textContent = "";
}

function openSignup() {
  document.getElementById("signupPopup").style.display = "flex";
}

function closeSignup() {
  const signupPopup = document.getElementById("signupPopup");
  signupPopup.style.display = "none";
  document.getElementById("signupForm").reset();
  document.getElementById("errorMsg").textContent = "";
  document.getElementById("successMsg").textContent = "";
  password.classList.remove("error", "valid");
  confirmPassword.classList.remove("error", "valid");
}

function switchToSignup() {
  closeLogin();
  openSignup();
}

// ======================= SHOPKEEPER FIELDS =======================
const roleSelect = document.getElementById("role");
const shopFields = document.querySelectorAll(".shopkeeper-only");

function toggleFields() {
  shopFields.forEach(el =>
    el.style.display = roleSelect.value === "shopkeeper" ? "block" : "none"
  );
}
if (roleSelect) {
  toggleFields();
  roleSelect.addEventListener("change", toggleFields);
}

// ======================= PASSWORD VALIDATION =======================
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirm_password");
const errorMsg = document.getElementById("errorMsg");
const successMsg = document.getElementById("successMsg");

function validatePassword() {
  if (confirmPassword.value === "") return true;
  if (password.value !== confirmPassword.value) {
    confirmPassword.classList.add("error");
    errorMsg.textContent = "Passwords do not match";
    return false;
  }
  confirmPassword.classList.remove("error");
  errorMsg.textContent = "";
  return true;
}

if (password && confirmPassword) {
  password.addEventListener("input", validatePassword);
  confirmPassword.addEventListener("input", validatePassword);
}

// ======================= SIGNUP SUBMIT =======================
const signupForm = document.getElementById("signupForm");
if (signupForm) {
  signupForm.addEventListener("submit", async e => {
    e.preventDefault();
    errorMsg.textContent = "";
    successMsg.textContent = "";

    if (!validatePassword()) return;

    try {
      const res = await fetch("/signup", {
        method: "POST",
        body: new FormData(e.target)
      });
      const data = await res.json();

      if (!res.ok) {
        errorMsg.textContent = data.message;
        return;
      }

      successMsg.textContent = "🎉 Registered successfully! Redirecting...";
      setTimeout(() => {
        closeSignup();
        openLogin();
      }, 2000);

    } catch {
      errorMsg.textContent = "Server error. Try again.";
    }
  });
}

// ======================= LOGIN SUBMIT =======================
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

if (loginForm) {
  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    loginError.textContent = "";

    const email = document.getElementById("loginEmail").value;
    const passwordValue = document.getElementById("loginPassword").value;

    try {
      const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: passwordValue })
      });

      const data = await res.json();
      if (!res.ok) {
        loginError.textContent = data.message;
        return;
      }

      // Store token, role, and user info
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Update UI
      showProfile(data.user);
      document.getElementById("loginNav").style.display = "none"; // hide login
      document.getElementById("userNav").style.display = "block"; // show profile

      closeLogin();
    } catch {
      loginError.textContent = "Server error. Try again.";
    }
  });
}

// ======================= PROFILE DISPLAY =======================
function showProfile(user) {
  const roleEl = document.getElementById("profileRole");
  if (!user) return;

  const role = user.id.charAt(0) === "C" ? "Customer" : "Shopkeeper";
  if (roleEl) {
    roleEl.textContent = role;
    roleEl.style.display = "inline-block";
  }

  document.getElementById("userName").textContent = user.full_name;
  document.getElementById("userPhone").textContent = "+977 " + user.mobile;
  document.getElementById("userEmail").textContent = user.email;
}

// ======================= AUTO LOAD AFTER REFRESH =======================
window.addEventListener("load", () => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (user) {
    showProfile(user);
    document.getElementById("loginNav").style.display = "none"; // hide login
    document.getElementById("userNav").style.display = "block"; // show profile
  }
});

// ======================= LOGOUT =======================
function logout() {
  localStorage.clear();
  document.getElementById("userNav").style.display = "none"; // hide profile
  document.getElementById("loginNav").style.display = "block"; // show login
  // Optionally reload page: location.reload();
  closeLogin();
}
