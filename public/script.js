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
  document.getElementById("loginPopup").style.display = "none";
  document.getElementById("loginForm").reset();
  document.getElementById("loginError").textContent = "";
}

function openSignup() {
  document.getElementById("signupPopup").style.display = "flex";
  // Reset to customer form when opening
  switchSignupForm('customer');
}

function closeSignup() {
  document.getElementById("signupPopup").style.display = "none";
  document.getElementById("customerSignupForm").reset();
  document.getElementById("shopkeeperSignupForm").reset();
  document.getElementById("errorMsg").textContent = "";
  document.getElementById("successMsg").textContent = "";
}

function switchToSignup() {
  closeLogin();
  openSignup();
}

// ======================= SWITCH BETWEEN CUSTOMER/SHOPKEEPER FORMS =======================
function switchSignupForm(role) {
  const customerForm = document.getElementById('customerSignupForm');
  const shopkeeperForm = document.getElementById('shopkeeperSignupForm');
  const customerBtns = document.querySelectorAll('.role-btn[onclick*="customer"]');
  const shopkeeperBtns = document.querySelectorAll('.role-btn[onclick*="shopkeeper"]');
  
  if (role === 'customer') {
    customerForm.style.display = 'block';
    shopkeeperForm.style.display = 'none';
    customerBtns.forEach(btn => btn.classList.add('active'));
    shopkeeperBtns.forEach(btn => btn.classList.remove('active'));
  } else {
    customerForm.style.display = 'none';
    shopkeeperForm.style.display = 'block';
    customerBtns.forEach(btn => btn.classList.remove('active'));
    shopkeeperBtns.forEach(btn => btn.classList.add('active'));
  }
}

// ======================= PASSWORD VALIDATION =======================
function validatePassword(passwordField, confirmField) {
  if (!confirmField || !passwordField) return true;
  if (confirmField.value === "") return true;
  
  if (passwordField.value !== confirmField.value) {
    confirmField.classList.add("error");
    return false;
  }
  
  confirmField.classList.remove("error");
  return true;
}

// Customer form password validation
const customerPassword = document.getElementById("customerPassword");
const customerConfirmPassword = document.getElementById("customerConfirmPassword");

if (customerPassword && customerConfirmPassword) {
  customerPassword.addEventListener("input", () => validatePassword(customerPassword, customerConfirmPassword));
  customerConfirmPassword.addEventListener("input", () => validatePassword(customerPassword, customerConfirmPassword));
}

// Shopkeeper form password validation
const shopkeeperPassword = document.getElementById("shopkeeperPassword");
const shopkeeperConfirmPassword = document.getElementById("shopkeeperConfirmPassword");

if (shopkeeperPassword && shopkeeperConfirmPassword) {
  shopkeeperPassword.addEventListener("input", () => validatePassword(shopkeeperPassword, shopkeeperConfirmPassword));
  shopkeeperConfirmPassword.addEventListener("input", () => validatePassword(shopkeeperPassword, shopkeeperConfirmPassword));
}

// ======================= SIGNUP SUBMIT =======================
async function handleSignup(e) {
  e.preventDefault();
  
  const form = e.target;
  const formData = new FormData(form);
  const role = formData.get("role");
  
  // Validate passwords
  let isValid = true;
  let errorMsg = document.getElementById("errorMsg");
  
  if (role === "customer") {
    isValid = validatePassword(customerPassword, customerConfirmPassword);
  } else {
    isValid = validatePassword(shopkeeperPassword, shopkeeperConfirmPassword);
  }
  
  if (!isValid) {
    if (errorMsg) errorMsg.textContent = "Passwords do not match";
    return;
  }
  
  if (errorMsg) errorMsg.textContent = "";
  const successMsg = document.getElementById("successMsg");
  if (successMsg) successMsg.textContent = "";

  try {
    const res = await fetch("/signup", {
      method: "POST",
      body: formData
    });
    
    const data = await res.json();

    if (!res.ok) {
      if (errorMsg) errorMsg.textContent = data.message;
      return;
    }

    if (successMsg) successMsg.textContent = "🎉 Registered successfully!";
    
    // Clear form and switch to login after 2 seconds
    setTimeout(() => {
      closeSignup();
      openLogin();
    }, 2000);

  } catch {
    if (errorMsg) errorMsg.textContent = "Server error. Try again.";
  }
}

// Attach event listeners to both forms
document.addEventListener("DOMContentLoaded", function() {
  const customerForm = document.getElementById("customerSignupForm");
  const shopkeeperForm = document.getElementById("shopkeeperSignupForm");
  
  if (customerForm) {
    customerForm.addEventListener("submit", handleSignup);
  }
  
  if (shopkeeperForm) {
    shopkeeperForm.addEventListener("submit", handleSignup);
  }
});

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

      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("user", JSON.stringify(data.user));

      showProfile(data.user);
      document.getElementById("loginNav").style.display = "none";
      document.getElementById("userNav").style.display = "block";

      closeLogin();
      loadProducts();
      
      // Sync localStorage cart with database after login
      syncCartWithDatabase();
      updateCartCountFromServer();
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
  if (user.id.startsWith("C")) {
    role = "Customer";
  } else if(user.id.startsWith("S")) {
    role = "Shopkeeper";
  } else if(user.id.startsWith("A")) {
    role = "Admin";
  } else {
    role = "User";
  }

  if (roleEl) {
    roleEl.textContent = role;
    roleEl.style.display = "inline-block";
  }

  document.getElementById("userName").textContent = user.full_name || "";
  document.getElementById("userPhone").textContent = user.mobile ? "+977 " + user.mobile : "";
  document.getElementById("userEmail").textContent = user.email || "";

  const uploadLink = document.getElementById("uploadLink");
  const adminLink = document.getElementById("adminLink");
  const shopkeeperDashboardLink = document.getElementById("shopkeeperDashboardLink");
  const tableDashboardLink = document.getElementById("tableDashboardLink"); // ADD THIS
  
  if (uploadLink) {
    uploadLink.style.display = role === "Shopkeeper" ? "block" : "none";
  }
  
  if (adminLink) {
    adminLink.style.display = role === "Admin" ? "block" : "none";
  }
  
  if (shopkeeperDashboardLink) {
    shopkeeperDashboardLink.style.display = role === "Shopkeeper" ? "block" : "none";
  }
  
  // SHOW TABLE DASHBOARD FOR ADMIN
  if (tableDashboardLink) {
    tableDashboardLink.style.display = role === "Admin" ? "block" : "none";
  }
}
// ======================= LOAD PRODUCTS =======================
async function loadProducts() {
  try {
    const response = await fetch("http://localhost:3000/products");
    const products = await response.json();
    
    const container = document.getElementById("product-container");
    if (!container) return;
    
    container.innerHTML = "";

    if (!products || !products.length) {
      container.innerHTML = '<div class="no-products">No products available yet</div>';
      return;
    }

    products.forEach(product => {
      const finalPrice = product.price - (product.price * product.discount) / 100;
      
      const card = document.createElement("div");
      card.className = "product-card";
      
      card.innerHTML = `
        <img src="http://localhost:3000/uploads/${product.image || 'default.jpg'}" 
             alt="${product.pname}" 
             onerror="this.src='image/default-product.jpg'">
        <div class="product-info">
          <h3>${product.pname}</h3>
          <p>${product.description || "No description"}</p>
          <p><b>Category:</b> ${product.category}</p>
          <p><b>Size:</b> ${product.size || "One Size"}</p>
          <p><b>Stock:</b> ${product.quantity} units</p>
          <div class="product-footer">
            <div class="product-price">₹${finalPrice.toFixed(2)}</div>
            ${product.discount > 0 ? 
              `<span style="color:green; font-size:14px;">${product.discount}% OFF</span>` : 
              ''}
          </div>
        </div>
      `;

      const btn = document.createElement("button");
      btn.className = "add-to-cart";
      btn.textContent = product.quantity > 0 ? "Add to Cart" : "Out of Stock";
      btn.disabled = product.quantity <= 0;
      
      if (product.quantity > 0) {
        btn.onclick = () => addToCartDatabase(product);
      }
      
      card.querySelector(".product-info").appendChild(btn);
      container.appendChild(card);
    });
  } catch (error) {
    console.error("Error loading products:", error);
    const container = document.getElementById("product-container");
    if (container) {
      container.innerHTML = '<div class="no-products">Error loading products</div>';
    }
  }
}

// ======================= CART FUNCTIONS (DATABASE VERSION) =======================

// Add to cart - Database version
async function addToCartDatabase(product) {
  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");

  if (!user || !token) {
    openLogin();
    return;
  }

  if (user.id.startsWith("S") || user.id.startsWith("A")) {
    alert("Only customers can add to cart!");
    return;
  }

  try {
    const response = await fetch("/api/cart/add", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        product_id: product.p_id,
        quantity: 1
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      alert(data.message || "Failed to add to cart");
      return;
    }

    alert("Product added to cart!");
    updateCartCountFromServer();
    
  } catch (error) {
    console.error("Error adding to cart:", error);
    alert("Network error. Please try again.");
  }
}

// Legacy function for backward compatibility
function addToCart(product) {
  addToCartDatabase(product);
}

// Update cart count from server
async function updateCartCountFromServer() {
  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");
  
  if (!user || !token) {
    updateCartCountFromLocalStorage();
    return;
  }
  
  try {
    const response = await fetch("/api/cart/count", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      updateCartCount(data.total_items || 0);
    } else {
      updateCartCountFromLocalStorage();
    }
  } catch (error) {
    console.error("Error fetching cart count:", error);
    updateCartCountFromLocalStorage();
  }
}

// Update cart count from localStorage (fallback)
function updateCartCountFromLocalStorage() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  updateCartCount(cart.reduce((sum, item) => sum + item.quantity, 0));
}

// Update cart count display
function updateCartCount(count = 0) {
  const cartCount = document.getElementById("cartCount");
  if (cartCount) {
    cartCount.textContent = count;
    cartCount.style.display = count > 0 ? "inline-block" : "none";
  }
}

// Sync localStorage cart with database
async function syncCartWithDatabase() {
  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");
  
  if (!user || !token) return;
  
  const localCart = JSON.parse(localStorage.getItem("cart")) || [];
  
  if (localCart.length > 0) {
    // Convert localStorage cart to database format
    const dbCartItems = localCart.map(item => ({
      product_id: item.p_id,
      quantity: item.quantity || 1
    }));
    
    try {
      const response = await fetch("/api/cart/sync", {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ items: dbCartItems })
      });
      
      const data = await response.json();
      console.log('Cart synced with database:', data);
      
      // Clear localStorage cart after successful sync
      if (response.ok) {
        localStorage.removeItem("cart");
      }
    } catch (error) {
      console.error('Error syncing cart:', error);
    }
  }
}

// ======================= SEARCH PRODUCTS =======================
function searchProducts() {
  const searchInput = document.querySelector('.search-box input');
  const searchTerm = searchInput.value.toLowerCase();
  
  const productCards = document.querySelectorAll('.product-card');
  
  productCards.forEach(card => {
    const productName = card.querySelector('h3').textContent.toLowerCase();
    const productDesc = card.querySelector('p').textContent.toLowerCase();
    
    if (productName.includes(searchTerm) || productDesc.includes(searchTerm)) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

// ======================= INITIAL LOAD =======================
window.addEventListener("load", () => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (user) {
    showProfile(user);
    document.getElementById("loginNav").style.display = "none";
    document.getElementById("userNav").style.display = "block";
    updateCartCountFromServer();
  } else {
    updateCartCountFromLocalStorage();
  }
  
  loadProducts();
});

// ======================= LOGOUT =======================
function logout() {
  localStorage.clear();
  document.getElementById("userNav").style.display = "none";
  document.getElementById("loginNav").style.display = "block";
  closeSignup();
  loadProducts();
  updateCartCount();
}

// ======================= GET CART ITEMS (for cart.html) =======================
async function getCartItems() {
  const token = localStorage.getItem("token");
  
  if (!token) {
    return { items: [], summary: { total_items: 0, total_amount: 0, items_count: 0 } };
  }
  
  try {
    const response = await fetch("/api/cart", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      return await response.json();
    }
    return { items: [], summary: { total_items: 0, total_amount: 0, items_count: 0 } };
  } catch (error) {
    console.error("Error fetching cart:", error);
    return { items: [], summary: { total_items: 0, total_amount: 0, items_count: 0 } };
  }
}

// ======================= UPDATE CART ITEM QUANTITY =======================
async function updateCartItemQuantity(productId, quantity) {
  const token = localStorage.getItem("token");
  
  if (!token) return false;
  
  try {
    const response = await fetch("/api/cart/update", {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        product_id: productId,
        quantity: parseInt(quantity)
      })
    });
    
    const data = await response.json();
    return response.ok;
  } catch (error) {
    console.error("Error updating cart:", error);
    return false;
  }
}

// ======================= REMOVE FROM CART =======================
async function removeFromCartDB(productId) {
  const token = localStorage.getItem("token");
  
  if (!token) return false;
  
  try {
    const response = await fetch(`/api/cart/remove/${productId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    return response.ok;
  } catch (error) {
    console.error("Error removing from cart:", error);
    return false;
  }
}

// ======================= CHECKOUT =======================
async function checkout(shippingAddress) {
  const token = localStorage.getItem("token");
  
  if (!token) return null;
  
  try {
    const response = await fetch("/api/order/checkout", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        shipping_address: shippingAddress
      })
    });
    
    const data = await response.json();
    return { success: response.ok, data: data };
  } catch (error) {
    console.error("Error during checkout:", error);
    return { success: false, data: { message: "Network error" } };
  }
}

// Add to showProfile function:
const shopkeeperDashboardLink = document.getElementById("shopkeeperDashboardLink");
if (shopkeeperDashboardLink) {
  shopkeeperDashboardLink.style.display = role === "Shopkeeper" ? "block" : "none";
}


// Add to your existing script.js

// ======================= SHOPKEEPER FUNCTIONS =======================

// Get shopkeeper orders
async function getShopkeeperOrders(page = 1, status = 'all') {
  const token = localStorage.getItem('token');
  
  try {
    const response = await fetch(`/api/shopkeeper/orders?page=${page}&limit=10&status=${status}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      return await response.json();
    }
    return { orders: [], pagination: { currentPage: 1, totalPages: 1, totalItems: 0 } };
  } catch (error) {
    console.error('Error fetching shopkeeper orders:', error);
    return { orders: [], pagination: { currentPage: 1, totalPages: 1, totalItems: 0 } };
  }
}

// Get shopkeeper products
async function getShopkeeperProducts() {
  const token = localStorage.getItem('token');
  
  try {
    const response = await fetch('/api/shopkeeper/products', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('Error fetching shopkeeper products:', error);
    return [];
  }
}

// Update shopkeeper order status
async function updateShopkeeperOrderStatus(orderId, status, note = '') {
  const token = localStorage.getItem('token');
  
  try {
    const response = await fetch(`/api/shopkeeper/orders/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: status,
        note: note
      })
    });
    
    const data = await response.json();
    return { success: response.ok, data: data };
  } catch (error) {
    console.error('Error updating order status:', error);
    return { success: false, data: { message: 'Network error' } };
  }
}

// Get shopkeeper stats
async function getShopkeeperStats() {
  const token = localStorage.getItem('token');
  
  try {
    const response = await fetch('/api/shopkeeper/stats', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      return await response.json();
    }
    return {};
  } catch (error) {
    console.error('Error fetching shopkeeper stats:', error);
    return {};
  }
}