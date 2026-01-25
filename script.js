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
  document.getElementById("loginEmail").focus();
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
  document.getElementById("signupPopup").style.display = "flex";
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

// ======================= PASSWORD VALIDATION =======================
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirm_password");
const errorMsg = document.getElementById("errorMsg");
const successMsg = document.getElementById("successMsg");

function validatePassword() {
  if (!confirmPassword || !password) return true;
  if (confirmPassword.value === "") return true;
  if (password.value !== confirmPassword.value) {
    confirmPassword.classList.add("error");
    if (errorMsg) errorMsg.textContent = "Passwords do not match";
    return false;
  }
  confirmPassword.classList.remove("error");
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
        if (loginError) loginError.textContent = data.message;
        return;
      }

      // Save to localStorage
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

  document.getElementById("userName").textContent = user.full_name || "";
  document.getElementById("userPhone").textContent = "+977 " + (user.mobile || "");
  document.getElementById("userEmail").textContent = user.email || "";

  // Show shopkeeper upload link if applicable
  const uploadLink = document.getElementById("uploadLink");
  if (uploadLink) uploadLink.style.display = role === "Shopkeeper" ? "block" : "none";
}

// // ======================= AUTO LOAD AFTER REFRESH =======================
window.addEventListener("load", () => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (user) {
    showProfile(user);
    document.getElementById("loginNav").style.display = "none";
    document.getElementById("userNav").style.display = "block";

    // Ensure modals are hidden
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
  // Clear user data
  localStorage.clear();

  // Hide user nav, show login nav
  document.getElementById("userNav").style.display = "none";
  document.getElementById("loginNav").style.display = "block";

  // Hide signup modal if open
  const signupPopup = document.getElementById("signupPopup");
  if (signupPopup) signupPopup.style.display = "none";

  // Open login modal automatically
  const loginPopup = document.getElementById("loginPopup");
  if (loginPopup) loginPopup.style.display = "flex";
  const loginEmail = document.getElementById("loginEmail");
  if (loginEmail) loginEmail.focus();
}
// ================= LOAD PRODUCTS =================
document.addEventListener("DOMContentLoaded", loadProducts);

function loadProducts() {
  fetch("http://localhost:3000")
    .then(res => res.json())
    .then(products => {
      const grid = document.getElementById("productsGrid");
      grid.innerHTML = "";

      products.forEach(p => {
        const card = document.createElement("div");
        card.className = "product-card";

        card.innerHTML = `
          <img src="uploads/${p.image}" alt="${p.pname}">
          <div class="product-name">${p.pname}</div>
          <div class="product-size">Size: ${p.size}</div>
          <div class="product-price">₹${p.price}</div>
          <button class="add-cart">Add to Cart</button>
        `;

        grid.appendChild(card);
      });
    })
    .catch(err => console.error(err));
}
fetch("http://localhost:3000/products")
  .then(res => res.json())
  .then(products => {
    const container = document.getElementById("product-container");
    container.innerHTML = "";

    products.forEach(p => {
      // Only show images starting with 'p' or 'P'
      if (!p.image.toLowerCase().startsWith("p")) return;

      const finalPrice = p.price - (p.price * p.discount) / 100;

      const card = document.createElement("div");
      card.className = "product-card";

      // Create card HTML
      card.innerHTML = `
        <img src="http://localhost:3000/uploads/${p.image}" alt="${p.pname}">
        <h3>${p.pname}</h3>
        <p>${p.description ? p.description : "No description available"}</p>
        <p><b>Size:</b> ${p.size}</p>
        <p><b>Price:</b> ₹${finalPrice.toFixed(2)}</p>
        <p><b>Discount:</b> ${p.discount}%</p>
        <p><b>Quantity:</b> <span class="product-quantity">${p.quantity}</span></p>
        <p><b>Added:</b> ${p.created_at ? new Date(p.created_at).toLocaleString() : "N/A"}</p>
      `;

      // Create Add to Cart button dynamically
      const btn = document.createElement("button");
      btn.textContent = "Add to Cart";

      // Check quantity text
      const quantityText = card.querySelector(".product-quantity").textContent;
      if (parseInt(quantityText) > 0) {
        btn.className = "add-cart";
        btn.onclick = () => addToCart(p.p_id);
        card.appendChild(btn);
      } else {
        // If quantity is 0, show Out of Stock instead
        const outStock = document.createElement("span");
        outStock.textContent = "Out of Stock";
        outStock.style.color = "red";
        outStock.style.fontWeight = "bold";
        card.appendChild(outStock);
      }

      container.appendChild(card);
    });
  })
  .catch(err => console.error(err));

// Example Add to Cart function
// function addToCart(pid) {
//   alert("Added to cart: " + pid);
// }


