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

  let role;
  if (user.id.startsWith("C")) role = "Customer";
  else if(user.id.startsWith("S")) role = "Shopkeeper";
  else role = "Admin";

  if (roleEl) {
    roleEl.textContent = role;
    roleEl.style.display = "inline-block";
  }

  document.getElementById("userName").textContent = user.full_name || "";
  document.getElementById("userPhone").textContent = "+977 " + (user.mobile || "");
  document.getElementById("userEmail").textContent = user.email || "";

  const uploadLink = document.getElementById("uploadLink");
  if (uploadLink) uploadLink.style.display = role === "Shopkeeper" ? "block" : "none";

  const adminLink = document.getElementById("adminLink");
  if (adminLink) adminLink.style.display = role === "Admin" ? "block" : "none";
}

// ======================= AUTO LOAD AFTER REFRESH =======================
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
  const loginEmail = document.getElementById("loginEmail");
  if (loginEmail) loginEmail.focus();
}

// ======================= LOAD PRODUCTS =======================
document.addEventListener("DOMContentLoaded", loadProducts);

function loadProducts() {
  fetch("http://localhost:3000/products")
    .then(res => res.json())
    .then(products => {
      const grid = document.getElementById("productsGrid");
      if (!grid) return;
      grid.innerHTML = "";

      products.forEach(p => {
        const card = document.createElement("div");
        card.className = "product-card";

        const finalPrice = p.price - (p.price * p.discount) / 100;

        card.innerHTML = `
          <img src="http://localhost:3000/uploads/${p.image}" alt="${p.pname}">
          <h3>${p.pname}</h3>
          <p>${p.description || "No description"}</p>
          <p><b>Size:</b> ${p.size}</p>
          <p><b>Price:</b> ₹${finalPrice.toFixed(2)}</p>
          <p><b>Quantity:</b> <span class="product-quantity">${p.quantity}</span></p>
        `;

        const btn = document.createElement("button");
        const quantityText = p.quantity;

        if (quantityText > 0) {
          btn.textContent = "Add to Cart";
          btn.onclick = () => addToCart(p);
        } else {
          btn.textContent = "Out of Stock";
          btn.disabled = true;
        }

        card.appendChild(btn);
        grid.appendChild(card);
      });
    })
    .catch(err => console.error(err));
}

// ======================= ADD TO CART FUNCTION =======================
function addToCart(product) {
  const role = localStorage.getItem("role");

  if (!role) {
    alert("Please login as a customer to add products to cart.");
    return;
  }

  if (role !== "customer") {
    alert("Only customers can add products to cart.");
    return;
  }

  // Retrieve cart from localStorage
  let cart = JSON.parse(localStorage.getItem("cart")) || [];

  // Check if product already exists
  const exists = cart.find(item => item.p_id === product.p_id);
  if (exists) {
    alert("Product already in cart.");
    return;
  }

  cart.push({
    p_id: product.p_id,
    pname: product.pname,
    price: parseFloat(product.price - (product.price * product.discount)/100),
    size: product.size,
    image: product.image,
    quantity: 1
  });

  localStorage.setItem("cart", JSON.stringify(cart));

  alert(`${product.pname} added to cart!`);

  // Redirect to cart page
  window.location.href = "cart.html";
}
