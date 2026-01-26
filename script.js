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
  const loginPopup = document.getElementById("loginPopup");
  if (loginPopup) {
    loginPopup.style.display = "flex";
    document.getElementById("loginEmail").focus();
  }
}

function closeLogin() {
  const loginPopup = document.getElementById("loginPopup");
  if (loginPopup) loginPopup.style.display = "none";

  const loginForm = document.getElementById("loginForm");
  if (loginForm) loginForm.reset();

  const loginError = document.getElementById("loginError");
  if (loginError) loginError.textContent = "";
}

function openSignup() {
  const signupPopup = document.getElementById("signupPopup");
  if (signupPopup) signupPopup.style.display = "flex";
}

function closeSignup() {
  const signupPopup = document.getElementById("signupPopup");
  if (signupPopup) signupPopup.style.display = "none";

  const signupForm = document.getElementById("signupForm");
  if (signupForm) signupForm.reset();

  const errorMsg = document.getElementById("errorMsg");
  const successMsg = document.getElementById("successMsg");
  if (errorMsg) errorMsg.textContent = "";
  if (successMsg) successMsg.textContent = "";

  const password = document.getElementById("password");
  const confirmPassword = document.getElementById("confirm_password");
  if (password) password.classList.remove("error", "valid");
  if (confirmPassword) confirmPassword.classList.remove("error", "valid");
}

function switchToSignup() {
  closeLogin();
  openSignup();
}

// ======================= SHOPKEEPER FIELDS =======================
const roleSelect = document.getElementById("role");
const shopFields = document.querySelectorAll(".shopkeeper-fields");

function toggleShopkeeperFields() {
  if (!roleSelect) return;
  shopFields.forEach(el =>
    el.style.display = roleSelect.value === "shopkeeper" ? "block" : "none"
  );
}

if (roleSelect) {
  toggleShopkeeperFields();
  roleSelect.addEventListener("change", toggleShopkeeperFields);
}

// ======================= SIGNUP EMAIL VALIDATION =======================
const signupEmail = document.getElementById("signupEmail");
const signupEmailError = document.getElementById("signupEmailError");

const signupEmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;

function validateSignupEmail() {
  const email = signupEmail.value.trim();

  if (!signupEmailRegex.test(email)) {
    signupEmailError.textContent = "Please enter a valid Gmail ending with .com";
    signupEmail.classList.add("error");
    signupEmail.classList.remove("valid");
    return false;
  } else {
    signupEmailError.textContent = "";
    signupEmail.classList.remove("error");
    signupEmail.classList.add("valid");
    return true;
  }
}

// Real-time validation
signupEmail.addEventListener("input", validateSignupEmail);

// Validate on signup submit
if (signupForm) {
  signupForm.addEventListener("submit", function(e) {
    if (!validateSignupEmail() || !validatePassword()) {
      e.preventDefault(); // stop submission if email or password invalid
    }
  });
}



// ======================= PASSWORD VALIDATION =======================
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirm_password");
const errorMsg = document.getElementById("errorMsg");
const successMsg = document.getElementById("successMsg");

function validatePassword() {
  if (!password || !confirmPassword) return true;
  if (confirmPassword.value === "") return true;

  if (password.value !== confirmPassword.value) {
    confirmPassword.classList.add("error");
    if (errorMsg) errorMsg.textContent = "Passwords do not match";
    return false;
  }

  confirmPassword.classList.remove("error");
  confirmPassword.classList.add("valid");
  if (errorMsg) errorMsg.textContent = "";
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
    if (!validatePassword()) return;

    if (errorMsg) errorMsg.textContent = "";
    if (successMsg) successMsg.textContent = "";

    try {
      const res = await fetch("/signup", {
        method: "POST",
        body: new FormData(e.target)
      });
      const data = await res.json();

      if (!res.ok) {
        if (errorMsg) errorMsg.textContent = data.message;
        return;
      }

      if (successMsg) successMsg.textContent = "🎉 Registered successfully! Redirecting...";
      setTimeout(() => {
        closeSignup();
        openLogin();
      }, 2000);

    } catch {
      if (errorMsg) errorMsg.textContent = "Server error. Try again.";
    }
  });
}

// ======================= LOGIN SUBMIT =======================
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

if (loginForm) {
  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    if (loginError) loginError.textContent = "";

    const email = loginEmail.value;
    const passwordValue = document.getElementById("loginPassword").value;

    try {
      const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: passwordValue })
      });

      const data = await res.json();

      if (!res.ok) {
        if (loginError) loginError.textContent = data.message;
        return;
      }

      // Save user session
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("user", JSON.stringify(data.user));

      showProfile(data.user);
      document.getElementById("loginNav").style.display = "none";
      document.getElementById("userNav").style.display = "block";

      closeLogin();
    } catch {
      if (loginError) loginError.textContent = "Server error. Try again.";
    }
  });
}

// ======================= PROFILE DISPLAY =======================
function showProfile(user) {
  if (!user) return;

  const roleEl = document.getElementById("profileRole");
  const role = user.id.charAt(0) === "C" ? "Customer" : "Shopkeeper";

  if (roleEl) {
    roleEl.textContent = role;
    roleEl.style.display = "inline-block";
  }

  const nameEl = document.getElementById("userName");
  const phoneEl = document.getElementById("userPhone");
  const emailEl = document.getElementById("userEmail");
  if (nameEl) nameEl.textContent = user.full_name || "";
  if (phoneEl) phoneEl.textContent = "+977 " + (user.mobile || "");
  if (emailEl) emailEl.textContent = user.email || "";

  // Show upload link for shopkeepers
  const uploadLink = document.getElementById("uploadLink");
  if (uploadLink) uploadLink.style.display = role === "Shopkeeper" ? "block" : "none";
}

// ======================= AUTO LOAD USER AFTER REFRESH =======================
window.addEventListener("load", () => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (user) {
    showProfile(user);
    document.getElementById("loginNav").style.display = "none";
    document.getElementById("userNav").style.display = "block";

    const loginPopup = document.getElementById("loginPopup");
    const signupPopup = document.getElementById("signupPopup");
    if (loginPopup) loginPopup.style.display = "none";
    if (signupPopup) signupPopup.style.display = "none";
  } else {
    document.getElementById("loginNav").style.display = "block";
    document.getElementById("userNav").style.display = "none";
  }
});

// ======================= LOGOUT =======================
function logout() {
  localStorage.clear();
  document.getElementById("userNav").style.display = "none";
  document.getElementById("loginNav").style.display = "block";

  const signupPopup = document.getElementById("signupPopup");
  if (signupPopup) signupPopup.style.display = "none";

  const loginPopup = document.getElementById("loginPopup");
  if (loginPopup) loginPopup.style.display = "flex";
  if (loginEmail) loginEmail.focus();
}

// ======================= LOAD PRODUCTS =======================
async function loadProducts() {
  try {
    const res = await fetch("/products"); // fetch from /products API
    if (!res.ok) throw new Error("Failed to fetch products");
    const products = await res.json();

    const container = document.getElementById("product-container");
    if (!container) return;
    container.innerHTML = "";

    products.forEach(p => {
      const finalPrice = p.price - (p.price * (p.discount || 0)) / 100;

      const card = document.createElement("div");
      card.className = "product-card";

      // Card HTML
      card.innerHTML = `
        <img src="/uploads/${p.image}" alt="${p.pname}">
        <h3>${p.pname}</h3>
        <p>${p.description || "No description available"}</p>
        <p><b>Size:</b> ${p.size}</p>
        <p><b>Price:</b> ₹${finalPrice.toFixed(2)}</p>
        <p><b>Discount:</b> ${p.discount || 0}%</p>
        <p><b>Quantity:</b> <span class="product-quantity">${p.quantity}</span></p>
        <p><b>Added:</b> ${p.created_at ? new Date(p.created_at).toLocaleString() : "N/A"}</p>
      `;

      const quantity = parseInt(p.quantity) || 0;

      const btn = document.createElement("button");
      btn.textContent = "Add to Cart";

      if (quantity > 0) {
        btn.className = "add-cart";
        btn.onclick = () => addToCart(p.p_id);
        card.appendChild(btn);
      } else {
        const outStock = document.createElement("span");
        outStock.textContent = "Out of Stock";
        outStock.style.color = "red";
        outStock.style.fontWeight = "bold";
        card.appendChild(outStock);
      }

      container.appendChild(card);
    });
  } catch (err) {
    console.error("Error loading products:", err);
  }
}

// Load products on page load
document.addEventListener("DOMContentLoaded", loadProducts);

// ======================= ADD TO CART =======================
function addToCart(pid) {
  alert("Added to cart: " + pid);
}
