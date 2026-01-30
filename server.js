import express from "express";
import mysql from "mysql2";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";

dotenv.config();

/* ================= BASIC SETUP ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= STATIC FILES ================= */
// Serve all files from public folder
app.use(express.static(path.join(__dirname, "public")));

// Create uploads directory
const uploadsDir = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploads
app.use("/uploads", express.static(uploadsDir));

/* ================= MULTER CONFIG ================= */
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

/* ================= MYSQL CONNECTION ================= */
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "dreambasket"
});

db.connect(err => {
  if (err) {
    console.error("MySQL connection error:", err);
    process.exit(1);
  }
  console.log("✅ MySQL Connected");
  
  createTables();
});

/* ================= CREATE TABLES ================= */
function createTables() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS admin (
      id VARCHAR(10) PRIMARY KEY,
      full_name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      mobile VARCHAR(15),
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS customers (
      id VARCHAR(10) PRIMARY KEY,
      full_name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      mobile VARCHAR(15),
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS shopkeepers (
      id VARCHAR(10) PRIMARY KEY,
      full_name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      mobile VARCHAR(15) NOT NULL,
      password VARCHAR(255) NOT NULL,
      shop_name VARCHAR(200) NOT NULL,
      shop_address TEXT NOT NULL,
      registration_no VARCHAR(50) UNIQUE NOT NULL,
      citizenship_image VARCHAR(255),
      status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
      verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS products (
      p_id VARCHAR(10) PRIMARY KEY,
      pname VARCHAR(200) NOT NULL,
      description TEXT,
      category VARCHAR(100) NOT NULL,
      size VARCHAR(255),
      quantity INT DEFAULT 0,
      price DECIMAL(10,2) NOT NULL,
      discount DECIMAL(5,2) DEFAULT 0.00,
      image VARCHAR(255),
      shopkeeper_id VARCHAR(10) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shopkeeper_id) REFERENCES shopkeepers(id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS cart (
      cart_id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id VARCHAR(10) NOT NULL,
      product_id VARCHAR(10) NOT NULL,
      quantity INT DEFAULT 1,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_cart_item (customer_id, product_id),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (product_id) REFERENCES products(p_id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS orders (
      order_id VARCHAR(15) PRIMARY KEY,
      customer_id VARCHAR(10) NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL,
      status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
      payment_status ENUM('pending', 'paid', 'failed') DEFAULT 'pending',
      shipping_address TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS order_items (
      order_item_id INT AUTO_INCREMENT PRIMARY KEY,
      order_id VARCHAR(15) NOT NULL,
      product_id VARCHAR(10) NOT NULL,
      quantity INT NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      subtotal DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(order_id),
      FOREIGN KEY (product_id) REFERENCES products(p_id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS shopkeeper_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id VARCHAR(15) NOT NULL,
      product_id VARCHAR(10) NOT NULL,
      shopkeeper_id VARCHAR(10) NOT NULL,
      customer_id VARCHAR(10) NOT NULL,
      quantity INT NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      subtotal DECIMAL(10,2) NOT NULL,
      status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(order_id),
      FOREIGN KEY (product_id) REFERENCES products(p_id),
      FOREIGN KEY (shopkeeper_id) REFERENCES shopkeepers(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS order_status_history (
      history_id INT AUTO_INCREMENT PRIMARY KEY,
      order_id VARCHAR(15) NOT NULL,
      shopkeeper_id VARCHAR(10),
      status VARCHAR(50) NOT NULL,
      note TEXT,
      updated_by ENUM('admin', 'shopkeeper', 'system') NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(order_id)
    )`
  ];

  tables.forEach((sql, index) => {
    db.query(sql, (err) => {
      if (err) {
        console.error(`Error creating table ${index + 1}:`, err.message);
      } else {
        console.log(`✅ Table ${index + 1} created/verified`);
      }
    });
  });

  // Insert default admin
  const adminSql = `
    INSERT INTO admin (id, full_name, email, mobile, password) 
    VALUES ('A111', 'Admin User', 'admin@dreambasket.com', '9800000000', 'admin123')
    ON DUPLICATE KEY UPDATE id=id
  `;
  db.query(adminSql, (err) => {
    if (err) console.error('Error inserting admin:', err);
    else console.log('✅ Admin user verified');
  });
}

/* ================= ID GENERATORS ================= */
function generateUserId(table, prefix, callback) {
  const sql = `SELECT id FROM ${table} ORDER BY CAST(SUBSTRING(id,2) AS UNSIGNED) DESC LIMIT 1`;

  db.query(sql, (err, rows) => {
    if (err) return callback(err);
    if (!rows.length) {
      if (prefix === "C") return callback(null, "C11111");
      if (prefix === "S") return callback(null, "S1111");
      if (prefix === "A") return callback(null, "A111");
    }
    const next = parseInt(rows[0].id.substring(1)) + 1;
    callback(null, prefix + next);
  });
}

function generateProductId(callback) {
  const sql = `SELECT p_id FROM products ORDER BY CAST(SUBSTRING(p_id,2) AS UNSIGNED) DESC LIMIT 1`;

  db.query(sql, (err, rows) => {
    if (err) return callback(err);
    if (!rows.length) return callback(null, "P1111");
    const num = parseInt(rows[0].p_id.substring(1)) + 1;
    callback(null, "P" + num);
  });
}

function generateOrderId(callback) {
  const sql = `SELECT order_id FROM orders ORDER BY order_id DESC LIMIT 1`;
  
  db.query(sql, (err, rows) => {
    if (err) return callback(err);
    if (!rows.length) return callback(null, "ORD10001");
    const lastId = rows[0].order_id;
    const num = parseInt(lastId.substring(3)) + 1;
    callback(null, "ORD" + num);
  });
}

/* ================= SIGNUP ================= */
app.post("/signup", upload.single("citizenship"), async (req, res) => {
  try {
    const {
      role,
      full_name,
      email,
      mobile,
      password,
      shop_name,
      shop_address,
      registration_no
    } = req.body;

    if (!role || !full_name || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const checkEmail = `
      SELECT email FROM customers WHERE email=?
      UNION
      SELECT email FROM shopkeepers WHERE email=?
      UNION
      SELECT email FROM admin WHERE email=?
    `;

    db.query(checkEmail, [email, email, email], (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      if (rows.length) return res.status(409).json({ message: "Email already exists" });

      if (role.toLowerCase() === "customer") {
        generateUserId("customers", "C", (err, id) => {
          if (err) return res.status(500).json({ message: err.message });

          const sql = `INSERT INTO customers (id, full_name, email, mobile, password) VALUES (?,?,?,?,?)`;

          db.query(sql, [id, full_name, email, mobile, hashed], err => {
            if (err) return res.status(500).json({ message: err.message });
            res.json({ 
              message: "Customer registered successfully", 
              user: { id, full_name, email, mobile, role: "customer" } 
            });
          });
        });
      } else if (role.toLowerCase() === "shopkeeper") {
        generateUserId("shopkeepers", "S", (err, id) => {
          if (err) return res.status(500).json({ message: err.message });

          const shopkeeperUploads = path.join(uploadsDir, "shopkeepers");
          if (!fs.existsSync(shopkeeperUploads)) {
            fs.mkdirSync(shopkeeperUploads, { recursive: true });
          }

          let imageName = null;
          if (req.file) {
            imageName = id + path.extname(req.file.originalname);
          }

          const sql = `
            INSERT INTO shopkeepers
            (id, full_name, email, mobile, password, shop_name, shop_address, registration_no, citizenship_image)
            VALUES (?,?,?,?,?,?,?,?,?)
          `;

          db.query(
            sql,
            [
              id,
              full_name,
              email,
              mobile,
              hashed,
              shop_name,
              shop_address,
              registration_no,
              imageName
            ],
            err => {
              if (err) return res.status(500).json({ message: err.message });

              if (req.file && imageName) {
                const oldPath = path.join(uploadsDir, req.file.filename);
                const newPath = path.join(shopkeeperUploads, imageName);
                fs.renameSync(oldPath, newPath);
              }

              res.json({ 
                message: "Shopkeeper registered successfully", 
                user: { 
                  id, 
                  full_name, 
                  email, 
                  mobile, 
                  shop_name, 
                  shop_address, 
                  registration_no,
                  role: "shopkeeper" 
                } 
              });
            }
          );
        });
      } else {
        res.status(400).json({ message: "Invalid role" });
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ================= LOGIN ================= */
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  // Check admin
  db.query("SELECT * FROM admin WHERE email=?", [email], async (err, adminRows) => {
    if (err) return res.status(500).json({ message: err.message });
    
    if (adminRows.length) {
      if (password !== adminRows[0].password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const admin = adminRows[0];
      const token = jwt.sign({ 
        id: admin.id, 
        role: "admin", 
        email: admin.email 
      }, JWT_SECRET, { expiresIn: '24h' });
      
      return res.json({ 
        role: "admin", 
        token,
        user: {
          id: admin.id,
          full_name: admin.full_name,
          email: admin.email,
          mobile: admin.mobile,
          role: "admin"
        }
      });
    }

    // Check customer
    db.query("SELECT * FROM customers WHERE email=?", [email], async (err, customerRows) => {
      if (err) return res.status(500).json({ message: err.message });
      
      if (customerRows.length) {
        const customer = customerRows[0];
        const isValid = await bcrypt.compare(password, customer.password);
        
        if (!isValid) {
          return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign({ 
          id: customer.id, 
          role: "customer", 
          email: customer.email 
        }, JWT_SECRET, { expiresIn: '24h' });
        
        return res.json({ 
          role: "customer", 
          token,
          user: {
            id: customer.id,
            full_name: customer.full_name,
            email: customer.email,
            mobile: customer.mobile,
            role: "customer"
          }
        });
      }

      // Check shopkeeper
      db.query("SELECT * FROM shopkeepers WHERE email=?", [email], async (err, shopkeeperRows) => {
        if (err) return res.status(500).json({ message: err.message });
        
        if (!shopkeeperRows.length) {
          return res.status(404).json({ message: "User not found" });
        }

        const shopkeeper = shopkeeperRows[0];
        const isValid = await bcrypt.compare(password, shopkeeper.password);
        
        if (!isValid) {
          return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign({ 
          id: shopkeeper.id, 
          role: "shopkeeper", 
          email: shopkeeper.email 
        }, JWT_SECRET, { expiresIn: '24h' });
        
        res.json({ 
          role: "shopkeeper", 
          token,
          user: {
            id: shopkeeper.id,
            full_name: shopkeeper.full_name,
            email: shopkeeper.email,
            mobile: shopkeeper.mobile,
            shop_name: shopkeeper.shop_name,
            shop_address: shopkeeper.shop_address,
            registration_no: shopkeeper.registration_no,
            status: shopkeeper.status,
            verified: shopkeeper.verified === 1,
            role: "shopkeeper"
          }
        });
      });
    });
  });
});

/* ================= GET ALL PRODUCTS ================= */
app.get("/products", (req, res) => {
  const sql = `
    SELECT p.*, s.shop_name 
    FROM products p 
    LEFT JOIN shopkeepers s ON p.shopkeeper_id = s.id 
    ORDER BY p.created_at DESC
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching products:', err);
      return res.status(500).json({ message: err.message });
    }
    
    res.json(results);
  });
});

/* ================= ADD PRODUCT ================= */
app.post("/add-product", upload.single("image"), (req, res) => {
  const {
    pname,
    description,
    category,
    price,
    discount,
    shopkeeper_id
  } = req.body;

  if (!shopkeeper_id || !shopkeeper_id.startsWith("S")) {
    return res.status(403).json({ message: "Only shopkeepers can add products" });
  }

  // Get sizes
  let sizes = [];
  if (Array.isArray(req.body["sizes[]"])) {
    sizes = req.body["sizes[]"];
  } else if (req.body["sizes[]"]) {
    sizes = [req.body["sizes[]"]];
  }
  
  // Calculate total quantity
  let totalQuantity = 1;
  
  if (req.body.direct_quantity) {
    totalQuantity = parseInt(req.body.direct_quantity);
  } else if (req.body.quantities) {
    try {
      const quantities = JSON.parse(req.body.quantities);
      totalQuantity = 0;
      sizes.forEach(size => {
        totalQuantity += parseInt(quantities[size]) || 0;
      });
    } catch (e) {
      totalQuantity = 1;
    }
  }
  
  if (isNaN(totalQuantity) || totalQuantity < 1) {
    totalQuantity = 1;
  }

  // Validate required fields
  if (!pname || !category || !price) {
    return res.status(400).json({ 
      message: "Missing required fields",
      details: { pname: !!pname, category: !!category, price: !!price }
    });
  }

  generateProductId((err, p_id) => {
    if (err) {
      console.error('Error generating product ID:', err);
      return res.status(500).json({ message: err.message });
    }

    const sizeStr = sizes.length > 0 ? sizes.join(", ") : "One Size";
    
    let imageName = "default.jpg";
    if (req.file) {
      imageName = p_id + path.extname(req.file.originalname);
      const oldPath = path.join(uploadsDir, req.file.filename);
      const newPath = path.join(uploadsDir, imageName);
      try {
        fs.renameSync(oldPath, newPath);
      } catch (err) {
        console.error('Error saving image:', err);
      }
    }

    const sql = `
      INSERT INTO products 
      (p_id, pname, description, category, size, quantity, price, discount, image, shopkeeper_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      p_id,
      pname,
      description || "",
      category,
      sizeStr,
      totalQuantity,
      parseFloat(price),
      parseFloat(discount || 0),
      imageName,
      shopkeeper_id
    ];

    db.query(sql, params, (err, result) => {
      if (err) {
        console.error('Database insert error:', err);
        return res.status(500).json({ 
          message: "Database error",
          error: err.message 
        });
      }

      res.json({ 
        message: "Product added successfully", 
        product_id: p_id,
        details: {
          size: sizeStr,
          quantity: totalQuantity,
          price: parseFloat(price),
          discount: parseFloat(discount || 0)
        }
      });
    });
  });
});

/* ================= AUTHENTICATION MIDDLEWARE ================= */
const authenticateUser = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const authenticateCustomer = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.role !== 'customer') {
      return res.status(403).json({ message: 'Customer access required' });
    }
    
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const authenticateShopkeeper = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.role !== 'shopkeeper') {
      return res.status(403).json({ message: 'Shopkeeper access required' });
    }
    
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

/* ================= CART ENDPOINTS ================= */
app.get("/api/cart", authenticateCustomer, (req, res) => {
  const customerId = req.user.id;
  
  const sql = `
    SELECT 
      c.cart_id,
      c.quantity,
      p.p_id,
      p.pname,
      p.description,
      p.category,
      p.size,
      p.price,
      p.discount,
      p.image,
      p.quantity as available_stock
    FROM cart c
    JOIN products p ON c.product_id = p.p_id
    WHERE c.customer_id = ?
    ORDER BY c.added_at DESC
  `;
  
  db.query(sql, [customerId], (err, results) => {
    if (err) {
      console.error('Error fetching cart:', err);
      return res.status(500).json({ message: err.message });
    }
    
    const cartItems = results.map(item => {
      const finalPrice = item.price - (item.price * item.discount) / 100;
      const subtotal = finalPrice * item.quantity;
      
      return {
        ...item,
        final_price: finalPrice,
        subtotal: subtotal,
        image_url: `/uploads/${item.image}`
      };
    });
    
    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
    
    res.json({
      items: cartItems,
      summary: {
        total_items: totalItems,
        total_amount: totalAmount,
        items_count: cartItems.length
      }
    });
  });
});

app.post("/api/cart/add", authenticateCustomer, (req, res) => {
  const { product_id, quantity } = req.body;
  const customerId = req.user.id;
  
  if (!product_id || !quantity) {
    return res.status(400).json({ message: "Product ID and quantity required" });
  }
  
  if (quantity < 1) {
    return res.status(400).json({ message: "Quantity must be at least 1" });
  }
  
  const checkProductSql = `SELECT p_id, pname, quantity as stock FROM products WHERE p_id = ?`;
  
  db.query(checkProductSql, [product_id], (err, productResults) => {
    if (err) return res.status(500).json({ message: err.message });
    if (productResults.length === 0) return res.status(404).json({ message: "Product not found" });
    
    const product = productResults[0];
    
    if (product.stock < quantity) {
      return res.status(400).json({ 
        message: `Only ${product.stock} units available in stock` 
      });
    }
    
    const checkCartSql = `SELECT quantity FROM cart WHERE customer_id = ? AND product_id = ?`;
    
    db.query(checkCartSql, [customerId, product_id], (err, cartResults) => {
      if (err) return res.status(500).json({ message: err.message });
      
      if (cartResults.length > 0) {
        const existingQuantity = cartResults[0].quantity;
        const newQuantity = existingQuantity + quantity;
        
        if (newQuantity > product.stock) {
          return res.status(400).json({ 
            message: `Cannot add ${quantity} more. Only ${product.stock - existingQuantity} available.` 
          });
        }
        
        const updateSql = `UPDATE cart SET quantity = ? WHERE customer_id = ? AND product_id = ?`;
        
        db.query(updateSql, [newQuantity, customerId, product_id], (err) => {
          if (err) return res.status(500).json({ message: err.message });
          res.json({ 
            message: "Cart updated successfully",
            cart_item: {
              product_id,
              quantity: newQuantity,
              product_name: product.pname
            }
          });
        });
      } else {
        const insertSql = `INSERT INTO cart (customer_id, product_id, quantity) VALUES (?, ?, ?)`;
        
        db.query(insertSql, [customerId, product_id, quantity], (err) => {
          if (err) return res.status(500).json({ message: err.message });
          res.json({ 
            message: "Item added to cart successfully",
            cart_item: {
              product_id,
              quantity,
              product_name: product.pname
            }
          });
        });
      }
    });
  });
});

app.put("/api/cart/update", authenticateCustomer, (req, res) => {
  const { product_id, quantity } = req.body;
  const customerId = req.user.id;
  
  if (!product_id || quantity === undefined) {
    return res.status(400).json({ message: "Product ID and quantity required" });
  }
  
  if (quantity < 0) return res.status(400).json({ message: "Quantity cannot be negative" });
  
  if (quantity === 0) {
    const deleteSql = `DELETE FROM cart WHERE customer_id = ? AND product_id = ?`;
    
    db.query(deleteSql, [customerId, product_id], (err) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json({ message: "Item removed from cart", removed: true });
    });
  } else {
    const checkStockSql = `SELECT quantity as stock FROM products WHERE p_id = ?`;
    
    db.query(checkStockSql, [product_id], (err, stockResults) => {
      if (err) return res.status(500).json({ message: err.message });
      if (stockResults.length === 0) return res.status(404).json({ message: "Product not found" });
      
      const availableStock = stockResults[0].stock;
      
      if (quantity > availableStock) {
        return res.status(400).json({ 
          message: `Only ${availableStock} units available in stock` 
        });
      }
      
      const updateSql = `UPDATE cart SET quantity = ? WHERE customer_id = ? AND product_id = ?`;
      
      db.query(updateSql, [quantity, customerId, product_id], (err, result) => {
        if (err) return res.status(500).json({ message: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: "Cart item not found" });
        
        res.json({ 
          message: "Cart updated successfully",
          updated: true,
          new_quantity: quantity
        });
      });
    });
  }
});

app.delete("/api/cart/remove/:product_id", authenticateCustomer, (req, res) => {
  const { product_id } = req.params;
  const customerId = req.user.id;
  
  if (!product_id) return res.status(400).json({ message: "Product ID required" });
  
  const deleteSql = `DELETE FROM cart WHERE customer_id = ? AND product_id = ?`;
  
  db.query(deleteSql, [customerId, product_id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Cart item not found" });
    
    res.json({ message: "Item removed from cart successfully", removed: true });
  });
});

app.delete("/api/cart/clear", authenticateCustomer, (req, res) => {
  const customerId = req.user.id;
  
  const deleteSql = `DELETE FROM cart WHERE customer_id = ?`;
  
  db.query(deleteSql, [customerId], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ message: "Cart cleared successfully", items_removed: result.affectedRows });
  });
});

app.get("/api/cart/count", authenticateCustomer, (req, res) => {
  const customerId = req.user.id;
  
  const sql = `SELECT SUM(quantity) as total_items FROM cart WHERE customer_id = ?`;
  
  db.query(sql, [customerId], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    const totalItems = results[0].total_items || 0;
    res.json({ total_items: totalItems });
  });
});

/* ================= CHECKOUT & ORDER ENDPOINTS ================= */
app.post("/api/order/checkout", authenticateCustomer, (req, res) => {
  const { shipping_address } = req.body;
  const customerId = req.user.id;
  
  if (!shipping_address) {
    return res.status(400).json({ message: "Shipping address required" });
  }
  
  db.beginTransaction((err) => {
    if (err) return res.status(500).json({ message: err.message });
    
    const getCartSql = `
      SELECT 
        c.product_id,
        c.quantity,
        p.pname,
        p.price,
        p.discount,
        p.shopkeeper_id,
        p.quantity as available_stock
      FROM cart c
      JOIN products p ON c.product_id = p.p_id
      WHERE c.customer_id = ?
    `;
    
    db.query(getCartSql, [customerId], (err, cartItems) => {
      if (err) {
        return db.rollback(() => {
          res.status(500).json({ message: err.message });
        });
      }
      
      if (cartItems.length === 0) {
        return db.rollback(() => {
          res.status(400).json({ message: "Cart is empty" });
        });
      }
      
      let totalAmount = 0;
      const orderItems = [];
      
      for (const item of cartItems) {
        if (item.quantity > item.available_stock) {
          return db.rollback(() => {
            res.status(400).json({ 
              message: `Insufficient stock for ${item.pname}. Available: ${item.available_stock}, Requested: ${item.quantity}` 
            });
          });
        }
        
        const finalPrice = item.price - (item.price * item.discount) / 100;
        const subtotal = finalPrice * item.quantity;
        
        orderItems.push({
          product_id: item.product_id,
          shopkeeper_id: item.shopkeeper_id,
          quantity: item.quantity,
          unit_price: finalPrice,
          subtotal: subtotal,
          product_name: item.pname
        });
        
        totalAmount += subtotal;
      }
      
      generateOrderId((err, orderId) => {
        if (err) {
          return db.rollback(() => {
            res.status(500).json({ message: err.message });
          });
        }
        
        const orderSql = `INSERT INTO orders (order_id, customer_id, total_amount, shipping_address) VALUES (?, ?, ?, ?)`;
        
        db.query(orderSql, [orderId, customerId, totalAmount, shipping_address], (err) => {
          if (err) {
            return db.rollback(() => {
              res.status(500).json({ message: err.message });
            });
          }
          
          const orderItemsValues = orderItems.map(item => [
            orderId,
            item.product_id,
            item.quantity,
            item.unit_price,
            item.subtotal
          ]);
          
          const orderItemsSql = `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES ?`;
          
          db.query(orderItemsSql, [orderItemsValues], (err) => {
            if (err) {
              return db.rollback(() => {
                res.status(500).json({ message: err.message });
              });
            }
            
            const shopkeeperOrdersValues = orderItems.map(item => [
              orderId,
              item.product_id,
              item.shopkeeper_id,
              customerId,
              item.quantity,
              item.unit_price,
              item.subtotal
            ]);
            
            const shopkeeperOrdersSql = `INSERT INTO shopkeeper_orders (order_id, product_id, shopkeeper_id, customer_id, quantity, unit_price, subtotal) VALUES ?`;
            
            db.query(shopkeeperOrdersSql, [shopkeeperOrdersValues], (err) => {
              if (err) {
                return db.rollback(() => {
                  res.status(500).json({ message: err.message });
                });
              }
              
              const updateStockPromises = orderItems.map(item => {
                return new Promise((resolve, reject) => {
                  const updateSql = `UPDATE products SET quantity = quantity - ? WHERE p_id = ?`;
                  db.query(updateSql, [item.quantity, item.product_id], (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                });
              });
              
              Promise.all(updateStockPromises)
                .then(() => {
                  db.query('DELETE FROM cart WHERE customer_id = ?', [customerId], (err) => {
                    if (err) {
                      return db.rollback(() => {
                        res.status(500).json({ message: err.message });
                      });
                    }
                    
                    db.commit((err) => {
                      if (err) {
                        return db.rollback(() => {
                          res.status(500).json({ message: err.message });
                        });
                      }
                      
                      // Add order status history
                      const historySql = `
                        INSERT INTO order_status_history 
                        (order_id, status, note, updated_by)
                        VALUES (?, 'pending', 'Order placed', 'system')
                      `;
                      db.query(historySql, [orderId]);
                      
                      res.json({
                        message: "Order placed successfully",
                        order_id: orderId,
                        total_amount: totalAmount,
                        items_count: orderItems.length
                      });
                    });
                  });
                })
                .catch((error) => {
                  db.rollback(() => {
                    res.status(500).json({ message: error.message });
                  });
                });
            });
          });
        });
      });
    });
  });
});

// Get customer order history
app.get("/api/orders/history", authenticateCustomer, (req, res) => {
  const customerId = req.user.id;
  
  const sql = `
    SELECT 
      o.order_id,
      o.total_amount,
      o.status,
      o.payment_status,
      o.shipping_address,
      o.created_at,
      COUNT(oi.order_item_id) as items_count
    FROM orders o
    LEFT JOIN order_items oi ON o.order_id = oi.order_id
    WHERE o.customer_id = ?
    GROUP BY o.order_id
    ORDER BY o.created_at DESC
  `;
  
  db.query(sql, [customerId], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ orders: results, total_orders: results.length });
  });
});

// Get order details
app.get("/api/order/:order_id", authenticateCustomer, (req, res) => {
  const { order_id } = req.params;
  const customerId = req.user.id;
  
  const orderSql = `SELECT * FROM orders WHERE order_id = ? AND customer_id = ?`;
  
  db.query(orderSql, [order_id, customerId], (err, orderResults) => {
    if (err) return res.status(500).json({ message: err.message });
    if (orderResults.length === 0) return res.status(404).json({ message: "Order not found" });
    
    const order = orderResults[0];
    
    const itemsSql = `
      SELECT 
        oi.*,
        p.pname,
        p.image,
        p.category
      FROM order_items oi
      JOIN products p ON oi.product_id = p.p_id
      WHERE oi.order_id = ?
    `;
    
    db.query(itemsSql, [order_id], (err, itemsResults) => {
      if (err) return res.status(500).json({ message: err.message });
      
      res.json({
        order: order,
        items: itemsResults,
        items_count: itemsResults.length
      });
    });
  });
});

/* ================= SHOPKEEPER ORDER MANAGEMENT ================= */

// Get shopkeeper's orders
app.get("/api/shopkeeper/orders", authenticateShopkeeper, (req, res) => {
  const shopkeeperId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const status = req.query.status || 'all';
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE so.shopkeeper_id = ?';
  const params = [shopkeeperId];

  if (status !== 'all') {
    whereClause += ' AND so.status = ?';
    params.push(status);
  }

  // Count
  const countSql = `
    SELECT COUNT(DISTINCT so.order_id) as total 
    FROM shopkeeper_orders so
    ${whereClause}
  `;
  
  db.query(countSql, params, (err, countResult) => {
    if (err) return res.status(500).json({ message: err.message });

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    // Get orders
    const ordersSql = `
      SELECT 
        so.order_id,
        o.total_amount,
        o.status as overall_status,
        o.payment_status,
        o.shipping_address,
        o.created_at,
        c.full_name as customer_name,
        c.email as customer_email,
        c.mobile as customer_mobile,
        COUNT(DISTINCT so.product_id) as products_count,
        SUM(so.quantity) as total_quantity,
        SUM(so.subtotal) as shopkeeper_total
      FROM shopkeeper_orders so
      JOIN orders o ON so.order_id = o.order_id
      JOIN customers c ON o.customer_id = c.id
      ${whereClause}
      GROUP BY so.order_id, o.total_amount, o.status, o.payment_status, 
               o.shipping_address, o.created_at, c.full_name, c.email, c.mobile
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const ordersParams = [...params, limit, offset];

    db.query(ordersSql, ordersParams, (err, orders) => {
      if (err) return res.status(500).json({ message: err.message });

      res.json({
        orders: orders,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalItems: total,
          itemsPerPage: limit
        }
      });
    });
  });
});

// Get shopkeeper's order details
app.get("/api/shopkeeper/orders/:order_id", authenticateShopkeeper, (req, res) => {
  const shopkeeperId = req.user.id;
  const { order_id } = req.params;

  // Get order header
  const orderSql = `
    SELECT 
      o.*,
      c.full_name as customer_name,
      c.email as customer_email,
      c.mobile as customer_mobile
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    WHERE o.order_id = ? AND EXISTS (
      SELECT 1 FROM shopkeeper_orders so 
      WHERE so.order_id = o.order_id AND so.shopkeeper_id = ?
    )
  `;

  db.query(orderSql, [order_id, shopkeeperId], (err, orderResults) => {
    if (err) return res.status(500).json({ message: err.message });
    if (orderResults.length === 0) return res.status(404).json({ message: 'Order not found or unauthorized' });

    const order = orderResults[0];

    // Get order items for this shopkeeper
    const itemsSql = `
      SELECT 
        so.*,
        p.pname,
        p.description,
        p.category,
        p.size,
        p.image
      FROM shopkeeper_orders so
      JOIN products p ON so.product_id = p.p_id
      WHERE so.order_id = ? AND so.shopkeeper_id = ?
    `;

  db.query(itemsSql, [order_id, shopkeeperId], (err, itemsResults) => {
    if (err) return res.status(500).json({ message: err.message });

      const shopkeeperTotal = itemsResults.reduce((sum, item) => sum + item.subtotal, 0);
      const totalQuantity = itemsResults.reduce((sum, item) => sum + item.quantity, 0);

      res.json({
        order: {
          ...order,
          shopkeeper_total: shopkeeperTotal,
          shopkeeper_items_count: itemsResults.length,
          shopkeeper_total_quantity: totalQuantity
        },
        items: itemsResults,
        summary: {
          items_count: itemsResults.length,
          total_quantity: totalQuantity,
          subtotal: shopkeeperTotal
        }
      });
    });
  });
});

// Update order status (shopkeeper)
app.put("/api/shopkeeper/orders/:order_id/status", authenticateShopkeeper, (req, res) => {
  const shopkeeperId = req.user.id;
  const { order_id } = req.params;
  const { status, note } = req.body;

  const validStatuses = ['processing', 'shipped', 'cancelled'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ 
      message: 'Invalid status. Allowed: ' + validStatuses.join(', ') 
    });
  }

  // Update shopkeeper order status
  const updateSql = `
    UPDATE shopkeeper_orders 
    SET status = ? 
    WHERE order_id = ? AND shopkeeper_id = ?
  `;

  db.query(updateSql, [status, order_id, shopkeeperId], (err, updateResult) => {
    if (err) return res.status(500).json({ message: err.message });

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ message: 'No items found for this shopkeeper' });
    }

    // Add to history
    const historySql = `
      INSERT INTO order_status_history 
      (order_id, shopkeeper_id, status, note, updated_by)
      VALUES (?, ?, ?, ?, 'shopkeeper')
    `;

    db.query(historySql, [order_id, shopkeeperId, status, note || `Updated by shopkeeper`, 'shopkeeper'], (err) => {
      if (err) console.error('Error saving history:', err);
      
      res.json({ 
        message: `Order status updated to ${status}`,
        updated_items: updateResult.affectedRows
      });
    });
  });
});

// Get shopkeeper's sales statistics
app.get("/api/shopkeeper/stats", authenticateShopkeeper, (req, res) => {
  const shopkeeperId = req.user.id;

  const statsSql = `
    SELECT 
      -- Total orders
      COUNT(DISTINCT order_id) as total_orders,
      
      -- Revenue
      COALESCE(SUM(subtotal), 0) as total_revenue,
      
      -- Items sold
      COALESCE(SUM(quantity), 0) as items_sold,
      
      -- Average order value
      CASE 
        WHEN COUNT(DISTINCT order_id) > 0 
        THEN COALESCE(SUM(subtotal), 0) / COUNT(DISTINCT order_id)
        ELSE 0 
      END as avg_order_value,
      
      -- Status breakdown
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_orders,
      SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) as shipped_orders,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_orders,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
    FROM shopkeeper_orders
    WHERE shopkeeper_id = ?
  `;

  db.query(statsSql, [shopkeeperId], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(results[0] || {});
  });
});

// Get shopkeeper's products
app.get("/api/shopkeeper/products", authenticateShopkeeper, (req, res) => {
  const shopkeeperId = req.user.id;
  
  const sql = `SELECT * FROM products WHERE shopkeeper_id = ? ORDER BY created_at DESC`;
  
  db.query(sql, [shopkeeperId], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(results);
  });
});

/* ================= ADMIN ENDPOINTS ================= */

// Admin stats
app.get("/api/admin/stats", authenticateAdmin, (req, res) => {
  const stats = {};
  
  // Total shopkeepers
  db.query('SELECT COUNT(*) as count FROM shopkeepers', (err, result) => {
    if (err) stats.totalShopkeepers = 0;
    else stats.totalShopkeepers = result[0].count;
    
    // Pending shopkeepers
    db.query('SELECT COUNT(*) as count FROM shopkeepers WHERE status = "pending"', (err, result) => {
      if (err) stats.pendingShopkeepers = 0;
      else stats.pendingShopkeepers = result[0].count;
      
      // Approved shopkeepers
      db.query('SELECT COUNT(*) as count FROM shopkeepers WHERE status = "approved"', (err, result) => {
        if (err) stats.approvedShopkeepers = 0;
        else stats.approvedShopkeepers = result[0].count;
        
        // Total customers
        db.query('SELECT COUNT(*) as count FROM customers', (err, result) => {
          if (err) stats.totalCustomers = 0;
          else stats.totalCustomers = result[0].count;
          
          // Total products
          db.query('SELECT COUNT(*) as count FROM products', (err, result) => {
            if (err) stats.totalProducts = 0;
            else stats.totalProducts = result[0].count;
            
            // Total orders
            db.query('SELECT COUNT(*) as count FROM orders', (err, result) => {
              if (err) stats.totalOrders = 0;
              else stats.totalOrders = result[0].count;
              
              // Total revenue
              db.query('SELECT COALESCE(SUM(total_amount), 0) as revenue FROM orders WHERE status != "cancelled"', (err, result) => {
                if (err) stats.totalRevenue = 0;
                else stats.totalRevenue = result[0].revenue;
                
                res.json(stats);
              });
            });
          });
        });
      });
    });
  });
});

// Get shopkeepers for admin
app.get("/api/admin/shopkeepers", authenticateAdmin, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const status = req.query.status || 'all';
  const offset = (page - 1) * limit;

  let whereClause = '';
  const params = [];

  if (search) {
    whereClause += ` WHERE (s.full_name LIKE ? OR s.email LIKE ? OR s.shop_name LIKE ? OR s.registration_no LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status !== 'all') {
    if (whereClause) whereClause += ' AND s.status = ?';
    else whereClause = ' WHERE s.status = ?';
    params.push(status);
  }

  // Count
  const countQuery = `SELECT COUNT(*) as total FROM shopkeepers s ${whereClause}`;
  
  db.query(countQuery, params, (err, countResult) => {
    if (err) return res.status(500).json({ message: err.message });

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    // Data
    const dataQuery = `
      SELECT 
        s.*,
        (SELECT COUNT(*) FROM products p WHERE p.shopkeeper_id = s.id) as products_count,
        DATE_FORMAT(s.created_at, '%Y-%m-%d') as created_date
      FROM shopkeepers s
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit, offset];

    db.query(dataQuery, dataParams, (err, results) => {
      if (err) return res.status(500).json({ message: err.message });

      const formattedResults = results.map(shopkeeper => ({
        ...shopkeeper,
        citizenship_image: shopkeeper.citizenship_image || 'default-document.jpg',
        verified: shopkeeper.verified === 1
      }));

      res.json({
        shopkeepers: formattedResults,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalItems: total,
          itemsPerPage: limit
        }
      });
    });
  });
});

// Approve shopkeeper
app.put("/api/admin/shopkeepers/:id/approve", authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const sql = `UPDATE shopkeepers SET status = 'approved', verified = 1 WHERE id = ?`;
  
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Shopkeeper not found' });
    res.json({ message: 'Shopkeeper approved successfully' });
  });
});

// Reject shopkeeper
app.put("/api/admin/shopkeepers/:id/reject", authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const sql = `UPDATE shopkeepers SET status = 'rejected', verified = 0 WHERE id = ?`;
  
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Shopkeeper not found' });
    res.json({ message: 'Shopkeeper rejected successfully' });
  });
});

// Remove shopkeeper
app.delete("/api/admin/shopkeepers/:id", authenticateAdmin, (req, res) => {
  const { id } = req.params;
  
  db.beginTransaction((err) => {
    if (err) return res.status(500).json({ message: err.message });
    
    // First, delete shopkeeper's products
    const deleteProductsSql = `DELETE FROM products WHERE shopkeeper_id = ?`;
    db.query(deleteProductsSql, [id], (err) => {
      if (err) {
        return db.rollback(() => {
          res.status(500).json({ message: err.message });
        });
      }
      
      // Then delete shopkeeper orders
      const deleteShopkeeperOrdersSql = `DELETE FROM shopkeeper_orders WHERE shopkeeper_id = ?`;
      db.query(deleteShopkeeperOrdersSql, [id], (err) => {
        if (err) {
          return db.rollback(() => {
            res.status(500).json({ message: err.message });
          });
        }
        
        // Finally delete shopkeeper
        const deleteShopkeeperSql = `DELETE FROM shopkeepers WHERE id = ?`;
        db.query(deleteShopkeeperSql, [id], (err, result) => {
          if (err) {
            return db.rollback(() => {
              res.status(500).json({ message: err.message });
            });
          }
          
          if (result.affectedRows === 0) {
            return db.rollback(() => {
              res.status(404).json({ message: 'Shopkeeper not found' });
            });
          }
          
          db.commit((err) => {
            if (err) {
              return db.rollback(() => {
                res.status(500).json({ message: err.message });
              });
            }
            
            res.json({ 
              message: 'Shopkeeper removed successfully',
              removed: true
            });
          });
        });
      });
    });
  });
});

/* ================= ADDITIONAL UTILITY ENDPOINTS ================= */

// Get user info
app.get("/api/user/:id", authenticateUser, (req, res) => {
  const { id } = req.params;
  const prefix = id.charAt(0).toUpperCase();
  
  let table;
  switch(prefix) {
    case 'C': table = "customers"; break;
    case 'S': table = "shopkeepers"; break;
    case 'A': table = "admin"; break;
    default: return res.status(400).json({ message: "Invalid user ID" });
  }
  
  const sql = `SELECT * FROM ${table} WHERE id = ?`;
  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!results.length) return res.status(404).json({ message: "User not found" });
    
    const user = results[0];
    user.role = prefix === 'C' ? 'customer' : prefix === 'S' ? 'shopkeeper' : 'admin';
    user.verified = user.verified === 1;
    res.json(user);
  });
});

// Sync cart
app.post("/api/cart/sync", authenticateCustomer, (req, res) => {
  const customerId = req.user.id;
  const { items } = req.body;
  
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ message: "Items array required" });
  }
  
  let syncedCount = 0;
  let errors = [];
  
  const syncPromises = items.map(item => {
    return new Promise((resolve) => {
      if (!item.product_id || !item.quantity) {
        errors.push(`Invalid item: ${JSON.stringify(item)}`);
        return resolve();
      }
      
      const checkSql = `SELECT quantity as stock FROM products WHERE p_id = ?`;
      db.query(checkSql, [item.product_id], (err, results) => {
        if (err) {
          errors.push(`Error checking product ${item.product_id}: ${err.message}`);
          return resolve();
        }
        
        if (results.length === 0) {
          errors.push(`Product ${item.product_id} not found`);
          return resolve();
        }
        
        const availableStock = results[0].stock;
        const quantity = Math.min(item.quantity, availableStock);
        
        if (quantity <= 0) {
          errors.push(`Product ${item.product_id} out of stock`);
          return resolve();
        }
        
        const checkCartSql = `SELECT quantity FROM cart WHERE customer_id = ? AND product_id = ?`;
        db.query(checkCartSql, [customerId, item.product_id], (err, cartResults) => {
          if (err) {
            errors.push(`Error checking cart: ${err.message}`);
            return resolve();
          }
          
          if (cartResults.length > 0) {
            const existingQuantity = cartResults[0].quantity;
            const newQuantity = Math.min(existingQuantity + quantity, availableStock);
            
            const updateSql = `UPDATE cart SET quantity = ? WHERE customer_id = ? AND product_id = ?`;
            db.query(updateSql, [newQuantity, customerId, item.product_id], (err) => {
              if (err) {
                errors.push(`Error updating cart: ${err.message}`);
              } else {
                syncedCount++;
              }
              resolve();
            });
          } else {
            const insertSql = `INSERT INTO cart (customer_id, product_id, quantity) VALUES (?, ?, ?)`;
            db.query(insertSql, [customerId, item.product_id, quantity], (err) => {
              if (err) {
                errors.push(`Error adding to cart: ${err.message}`);
              } else {
                syncedCount++;
              }
              resolve();
            });
          }
        });
      });
    });
  });
  
  Promise.all(syncPromises).then(() => {
    res.json({
      message: `Cart synced successfully. ${syncedCount} items added/updated.`,
      synced_count: syncedCount,
      errors: errors
    });
  });
});

/* ================= SERVE PAGES ================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.get("/upload", (req, res) => {
  res.sendFile(path.join(__dirname, "public/upload.html"));
});

app.get("/cart", (req, res) => {
  res.sendFile(path.join(__dirname, "public/cart.html"));
});

app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "public/about.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin.html"));
});


app.get("/shopkeeper-dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public/shopkeeper-dashboard.html"));
});
/* ================= 404 HANDLER ================= */
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public/index.html"));
});

/* ================= START SERVER ================= */
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

// Use Render's PORT or default to 3000
const aPORT = process.env.PORT || 3000;

// Start server with error handling
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${aPORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV}`);
}).on('error', (err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});