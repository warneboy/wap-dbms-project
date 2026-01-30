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
app.use(express.static(path.join(__dirname, "public")));

const uploadsDir = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    
    `CREATE TABLE IF NOT EXISTS customers (
      id VARCHAR(10) PRIMARY KEY,
      full_name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      mobile VARCHAR(15),
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    
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
      FOREIGN KEY (shopkeeper_id) REFERENCES shopkeepers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    
    `CREATE TABLE IF NOT EXISTS cart (
      cart_id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id VARCHAR(10) NOT NULL,
      product_id VARCHAR(10) NOT NULL,
      quantity INT DEFAULT 1,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_cart_item (customer_id, product_id),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(p_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    
    `CREATE TABLE IF NOT EXISTS orders (
      order_id VARCHAR(15) PRIMARY KEY,
      customer_id VARCHAR(10) NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL,
      status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
      payment_status ENUM('pending', 'paid', 'failed') DEFAULT 'pending',
      shipping_address TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    
    `CREATE TABLE IF NOT EXISTS order_items (
      order_item_id INT AUTO_INCREMENT PRIMARY KEY,
      order_id VARCHAR(15) NOT NULL,
      product_id VARCHAR(10) NOT NULL,
      quantity INT NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      subtotal DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(p_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    
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
      FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(p_id) ON DELETE CASCADE,
      FOREIGN KEY (shopkeeper_id) REFERENCES shopkeepers(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    
    `CREATE TABLE IF NOT EXISTS order_status_history (
      history_id INT AUTO_INCREMENT PRIMARY KEY,
      order_id VARCHAR(15) NOT NULL,
      shopkeeper_id VARCHAR(10),
      status VARCHAR(50) NOT NULL,
      note TEXT,
      updated_by ENUM('admin', 'shopkeeper', 'system') NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
      FOREIGN KEY (shopkeeper_id) REFERENCES shopkeepers(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
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

  let sizes = [];
  if (Array.isArray(req.body["sizes[]"])) {
    sizes = req.body["sizes[]"];
  } else if (req.body["sizes[]"]) {
    sizes = [req.body["sizes[]"]];
  }
  
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

  const countSql = `
    SELECT COUNT(DISTINCT so.order_id) as total 
    FROM shopkeeper_orders so
    ${whereClause}
  `;
  
  db.query(countSql, params, (err, countResult) => {
    if (err) return res.status(500).json({ message: err.message });

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

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

app.get("/api/shopkeeper/orders/:order_id", authenticateShopkeeper, (req, res) => {
  const shopkeeperId = req.user.id;
  const { order_id } = req.params;

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

app.get("/api/shopkeeper/stats", authenticateShopkeeper, (req, res) => {
  const shopkeeperId = req.user.id;

  const statsSql = `
    SELECT 
      COUNT(DISTINCT order_id) as total_orders,
      COALESCE(SUM(subtotal), 0) as total_revenue,
      COALESCE(SUM(quantity), 0) as items_sold,
      CASE 
        WHEN COUNT(DISTINCT order_id) > 0 
        THEN COALESCE(SUM(subtotal), 0) / COUNT(DISTINCT order_id)
        ELSE 0 
      END as avg_order_value,
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

app.get("/api/shopkeeper/products", authenticateShopkeeper, (req, res) => {
  const shopkeeperId = req.user.id;
  
  const sql = `SELECT * FROM products WHERE shopkeeper_id = ? ORDER BY created_at DESC`;
  
  db.query(sql, [shopkeeperId], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(results);
  });
});

/* ================= ADMIN ENDPOINTS ================= */
app.get("/api/admin/stats", authenticateAdmin, (req, res) => {
  const stats = {};
  
  db.query('SELECT COUNT(*) as count FROM shopkeepers', (err, result) => {
    if (err) stats.totalShopkeepers = 0;
    else stats.totalShopkeepers = result[0].count;
    
    db.query('SELECT COUNT(*) as count FROM shopkeepers WHERE status = "pending"', (err, result) => {
      if (err) stats.pendingShopkeepers = 0;
      else stats.pendingShopkeepers = result[0].count;
      
      db.query('SELECT COUNT(*) as count FROM shopkeepers WHERE status = "approved"', (err, result) => {
        if (err) stats.approvedShopkeepers = 0;
        else stats.approvedShopkeepers = result[0].count;
        
        db.query('SELECT COUNT(*) as count FROM customers', (err, result) => {
          if (err) stats.totalCustomers = 0;
          else stats.totalCustomers = result[0].count;
          
          db.query('SELECT COUNT(*) as count FROM products', (err, result) => {
            if (err) stats.totalProducts = 0;
            else stats.totalProducts = result[0].count;
            
            db.query('SELECT COUNT(*) as count FROM orders', (err, result) => {
              if (err) stats.totalOrders = 0;
              else stats.totalOrders = result[0].count;
              
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

app.get("/api/admin/shopkeepers-list", authenticateAdmin, (req, res) => {
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

  const countQuery = `SELECT COUNT(*) as total FROM shopkeepers s ${whereClause}`;
  
  db.query(countQuery, params, (err, countResult) => {
    if (err) return res.status(500).json({ message: err.message });

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

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

app.put("/api/admin/shopkeepers/:id/approve", authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const sql = `UPDATE shopkeepers SET status = 'approved', verified = 1 WHERE id = ?`;
  
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Shopkeeper not found' });
    res.json({ message: 'Shopkeeper approved successfully' });
  });
});

app.put("/api/admin/shopkeepers/:id/reject", authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const sql = `UPDATE shopkeepers SET status = 'rejected', verified = 0 WHERE id = ?`;
  
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Shopkeeper not found' });
    res.json({ message: 'Shopkeeper rejected successfully' });
  });
});

app.delete("/api/admin/shopkeepers/:id", authenticateAdmin, (req, res) => {
  const { id } = req.params;
  
  db.beginTransaction((err) => {
    if (err) return res.status(500).json({ message: err.message });
    
    const deleteProductsSql = `DELETE FROM products WHERE shopkeeper_id = ?`;
    db.query(deleteProductsSql, [id], (err) => {
      if (err) {
        return db.rollback(() => {
          res.status(500).json({ message: err.message });
        });
      }
      
      const deleteShopkeeperOrdersSql = `DELETE FROM shopkeeper_orders WHERE shopkeeper_id = ?`;
      db.query(deleteShopkeeperOrdersSql, [id], (err) => {
        if (err) {
          return db.rollback(() => {
            res.status(500).json({ message: err.message });
          });
        }
        
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

/* ================= ENHANCED ADMIN TABLE VIEW ENDPOINTS ================= */
app.get("/api/admin/shopkeepers", authenticateAdmin, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const status = req.query.status || 'all';
  const offset = (page - 1) * limit;

  let whereClause = '';
  let params = [];

  if (search) {
    whereClause += ' WHERE (s.full_name LIKE ? OR s.email LIKE ? OR s.shop_name LIKE ? OR s.registration_no LIKE ? OR s.mobile LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status !== 'all') {
    if (whereClause) whereClause += ' AND s.status = ?';
    else whereClause = ' WHERE s.status = ?';
    params.push(status);
  }

  const countQuery = `SELECT COUNT(*) as total FROM shopkeepers s ${whereClause}`;
  
  db.query(countQuery, params, (err, countResult) => {
    if (err) return res.status(500).json({ message: err.message });

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    const dataQuery = `
      SELECT 
        s.*,
        (SELECT COUNT(*) FROM products p WHERE p.shopkeeper_id = s.id) as products_count,
        (SELECT COALESCE(SUM(so.subtotal), 0) FROM shopkeeper_orders so WHERE so.shopkeeper_id = s.id AND so.status = 'delivered') as total_sales,
        (SELECT COALESCE(SUM(so.quantity), 0) FROM shopkeeper_orders so WHERE so.shopkeeper_id = s.id AND so.status = 'delivered') as items_sold,
        DATE_FORMAT(s.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted
      FROM shopkeepers s
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit, offset];

    db.query(dataQuery, dataParams, (err, results) => {
      if (err) return res.status(500).json({ message: err.message });

      res.json({
        shopkeepers: results,
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

app.get("/api/admin/customers", authenticateAdmin, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const offset = (page - 1) * limit;

  let whereClause = '';
  let params = [];

  if (search) {
    whereClause += ' WHERE (c.full_name LIKE ? OR c.email LIKE ? OR c.mobile LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const countQuery = `SELECT COUNT(*) as total FROM customers c ${whereClause}`;
  
  db.query(countQuery, params, (err, countResult) => {
    if (err) return res.status(500).json({ message: err.message });

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    const dataQuery = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) as total_orders,
        (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.customer_id = c.id) as total_spent,
        (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) as last_order_date,
        DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted
      FROM customers c
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit, offset];

    db.query(dataQuery, dataParams, (err, results) => {
      if (err) return res.status(500).json({ message: err.message });

      res.json({
        customers: results,
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

app.get("/api/admin/products", authenticateAdmin, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const category = req.query.category || '';
  const status = req.query.status || 'all';
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (search) {
    whereClause += ' AND (p.pname LIKE ? OR p.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  if (category) {
    whereClause += ' AND p.category = ?';
    params.push(category);
  }

  if (status === 'low_stock') {
    whereClause += ' AND p.quantity > 0 AND p.quantity <= 10';
  } else if (status === 'out_of_stock') {
    whereClause += ' AND p.quantity = 0';
  } else if (status === 'in_stock') {
    whereClause += ' AND p.quantity > 10';
  }

  const countQuery = `SELECT COUNT(*) as total FROM products p ${whereClause}`;
  
  db.query(countQuery, params, (err, countResult) => {
    if (err) return res.status(500).json({ message: err.message });

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    const dataQuery = `
      SELECT 
        p.*,
        s.shop_name,
        s.full_name as shopkeeper_name,
        s.email as shopkeeper_email,
        (SELECT COUNT(DISTINCT oi.order_id) FROM order_items oi WHERE oi.product_id = p.p_id) as times_ordered,
        (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.product_id = p.p_id) as total_sold,
        (SELECT COALESCE(SUM(oi.subtotal), 0) FROM order_items oi WHERE oi.product_id = p.p_id) as total_revenue,
        CASE 
          WHEN p.quantity = 0 THEN 'Out of Stock'
          WHEN p.quantity <= 10 THEN 'Low Stock'
          ELSE 'In Stock'
        END as stock_status,
        DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted
      FROM products p
      LEFT JOIN shopkeepers s ON p.shopkeeper_id = s.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit, offset];

    db.query(dataQuery, dataParams, (err, results) => {
      if (err) return res.status(500).json({ message: err.message });

      res.json({
        products: results,
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

app.get("/api/admin/orders", authenticateAdmin, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const status = req.query.status || 'all';
  const payment_status = req.query.payment_status || 'all';
  const start_date = req.query.start_date || '';
  const end_date = req.query.end_date || '';
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (search) {
    whereClause += ' AND (o.order_id LIKE ? OR c.full_name LIKE ? OR c.email LIKE ? OR c.mobile LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status !== 'all') {
    whereClause += ' AND o.status = ?';
    params.push(status);
  }

  if (payment_status !== 'all') {
    whereClause += ' AND o.payment_status = ?';
    params.push(payment_status);
  }

  if (start_date) {
    whereClause += ' AND DATE(o.created_at) >= ?';
    params.push(start_date);
  }

  if (end_date) {
    whereClause += ' AND DATE(o.created_at) <= ?';
    params.push(end_date);
  }

  const countQuery = `SELECT COUNT(*) as total FROM orders o LEFT JOIN customers c ON o.customer_id = c.id ${whereClause}`;
  
  db.query(countQuery, params, (err, countResult) => {
    if (err) return res.status(500).json({ message: err.message });

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    const dataQuery = `
      SELECT 
        o.*,
        c.full_name as customer_name,
        c.email as customer_email,
        c.mobile as customer_mobile,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.order_id) as items_count,
        (SELECT COUNT(DISTINCT so.shopkeeper_id) FROM shopkeeper_orders so WHERE so.order_id = o.order_id) as shopkeepers_count,
        DATE_FORMAT(o.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted,
        DATE_FORMAT(o.created_at, '%Y-%m-%d') as order_date
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit, offset];

    db.query(dataQuery, dataParams, (err, results) => {
      if (err) return res.status(500).json({ message: err.message });

      res.json({
        orders: results,
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

app.get("/api/admin/shopkeeper-orders", authenticateAdmin, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const shopkeeper_id = req.query.shopkeeper_id || '';
  const status = req.query.status || 'all';
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (search) {
    whereClause += ' AND (so.order_id LIKE ? OR p.pname LIKE ? OR s.shop_name LIKE ? OR c.full_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (shopkeeper_id) {
    whereClause += ' AND so.shopkeeper_id = ?';
    params.push(shopkeeper_id);
  }

  if (status !== 'all') {
    whereClause += ' AND so.status = ?';
    params.push(status);
  }

  const countQuery = `
    SELECT COUNT(*) as total 
    FROM shopkeeper_orders so
    LEFT JOIN products p ON so.product_id = p.p_id
    LEFT JOIN shopkeepers s ON so.shopkeeper_id = s.id
    LEFT JOIN customers c ON so.customer_id = c.id
    ${whereClause}
  `;
  
  db.query(countQuery, params, (err, countResult) => {
    if (err) return res.status(500).json({ message: err.message });

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    const dataQuery = `
      SELECT 
        so.*,
        p.pname as product_name,
        p.category as product_category,
        p.image as product_image,
        s.shop_name as shopkeeper_name,
        s.email as shopkeeper_email,
        c.full_name as customer_name,
        c.email as customer_email,
        o.status as order_overall_status,
        o.payment_status as order_payment_status,
        DATE_FORMAT(so.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted
      FROM shopkeeper_orders so
      LEFT JOIN products p ON so.product_id = p.p_id
      LEFT JOIN shopkeepers s ON so.shopkeeper_id = s.id
      LEFT JOIN customers c ON so.customer_id = c.id
      LEFT JOIN orders o ON so.order_id = o.order_id
      ${whereClause}
      ORDER BY so.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit, offset];

    db.query(dataQuery, dataParams, (err, results) => {
      if (err) return res.status(500).json({ message: err.message });

      res.json({
        orders: results,
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

app.get("/api/admin/cart", authenticateAdmin, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const countQuery = `SELECT COUNT(*) as total FROM cart c`;
  
  db.query(countQuery, (err, countResult) => {
    if (err) return res.status(500).json({ message: err.message });

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    const dataQuery = `
      SELECT 
        c.*,
        cu.full_name as customer_name,
        cu.email as customer_email,
        p.pname as product_name,
        p.price as product_price,
        p.discount as product_discount,
        p.image as product_image,
        p.category as product_category,
        DATE_FORMAT(c.added_at, '%Y-%m-%d %H:%i:%s') as added_at_formatted
      FROM cart c
      LEFT JOIN customers cu ON c.customer_id = cu.id
      LEFT JOIN products p ON c.product_id = p.p_id
      ORDER BY c.added_at DESC
      LIMIT ? OFFSET ?
    `;

    db.query(dataQuery, [limit, offset], (err, results) => {
      if (err) return res.status(500).json({ message: err.message });

      res.json({
        items: results,
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

app.get("/api/admin/order-items", authenticateAdmin, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const order_id = req.query.order_id || '';
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (order_id) {
    whereClause += ' AND oi.order_id = ?';
    params.push(order_id);
  }

  const countQuery = `SELECT COUNT(*) as total FROM order_items oi ${whereClause}`;
  
  db.query(countQuery, params, (err, countResult) => {
    if (err) return res.status(500).json({ message: err.message });

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    const dataQuery = `
      SELECT 
        oi.*,
        p.pname,
        p.description,
        p.category,
        p.image,
        s.shop_name,
        s.full_name as shopkeeper_name,
        DATE_FORMAT(oi.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.p_id
      LEFT JOIN shopkeepers s ON p.shopkeeper_id = s.id
      ${whereClause}
      ORDER BY oi.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit, offset];

    db.query(dataQuery, dataParams, (err, results) => {
      if (err) return res.status(500).json({ message: err.message });

      res.json({
        order_items: results,
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

app.get("/api/admin/order-history", authenticateAdmin, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const order_id = req.query.order_id || '';
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (order_id) {
    whereClause += ' AND osh.order_id = ?';
    params.push(order_id);
  }

  const countQuery = `SELECT COUNT(*) as total FROM order_status_history osh ${whereClause}`;
  
  db.query(countQuery, params, (err, countResult) => {
    if (err) return res.status(500).json({ message: err.message });

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    const dataQuery = `
      SELECT 
        osh.*,
        s.shop_name as shopkeeper_name,
        DATE_FORMAT(osh.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted
      FROM order_status_history osh
      LEFT JOIN shopkeepers s ON osh.shopkeeper_id = s.id
      ${whereClause}
      ORDER BY osh.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit, offset];

    db.query(dataQuery, dataParams, (err, results) => {
      if (err) return res.status(500).json({ message: err.message });

      res.json({
        history: results,
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

/* ================= ADMIN CRUD OPERATIONS ================= */
app.delete("/api/admin/products/:id", authenticateAdmin, (req, res) => {
  const productId = req.params.id;
  
  const checkOrdersSql = `SELECT COUNT(*) as order_count FROM order_items WHERE product_id = ?`;
  
  db.query(checkOrdersSql, [productId], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    
    if (result[0].order_count > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete product. It has been ordered. Consider disabling it instead.' 
      });
    }
    
    const deleteCartSql = `DELETE FROM cart WHERE product_id = ?`;
    db.query(deleteCartSql, [productId], (err) => {
      if (err) return res.status(500).json({ message: err.message });
      
      const deleteProductSql = `DELETE FROM products WHERE p_id = ?`;
      
      db.query(deleteProductSql, [productId], (err, result) => {
        if (err) return res.status(500).json({ message: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Product not found' });
        
        res.json({ 
          message: 'Product deleted successfully',
          deleted: true
        });
      });
    });
  });
});

app.put("/api/admin/products/:id", authenticateAdmin, upload.single("image"), (req, res) => {
  const productId = req.params.id;
  const { 
    pname, 
    description, 
    category, 
    price, 
    discount, 
    quantity,
    size
  } = req.body;
  
  let updateFields = [];
  let params = [];
  
  if (pname) { updateFields.push("pname = ?"); params.push(pname); }
  if (description !== undefined) { updateFields.push("description = ?"); params.push(description); }
  if (category) { updateFields.push("category = ?"); params.push(category); }
  if (price) { updateFields.push("price = ?"); params.push(parseFloat(price)); }
  if (discount !== undefined) { updateFields.push("discount = ?"); params.push(parseFloat(discount)); }
  if (quantity !== undefined) { updateFields.push("quantity = ?"); params.push(parseInt(quantity)); }
  if (size !== undefined) { updateFields.push("size = ?"); params.push(size); }
  
  if (req.file) {
    const imageName = productId + path.extname(req.file.originalname);
    updateFields.push("image = ?");
    params.push(imageName);
    
    const oldPath = path.join(uploadsDir, req.file.filename);
    const newPath = path.join(uploadsDir, imageName);
    try {
      fs.renameSync(oldPath, newPath);
    } catch (err) {
      console.error('Error saving image:', err);
    }
  }
  
  if (updateFields.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }
  
  params.push(productId);
  
  const updateSql = `UPDATE products SET ${updateFields.join(', ')} WHERE p_id = ?`;
  
  db.query(updateSql, params, (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Product not found' });
    
    res.json({ 
      message: 'Product updated successfully',
      updated: true
    });
  });
});

app.put("/api/admin/orders/:order_id/status", authenticateAdmin, (req, res) => {
  const { order_id } = req.params;
  const { status, note } = req.body;

  const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ 
      message: 'Invalid status. Allowed: ' + validStatuses.join(', ') 
    });
  }

  const updateSql = `UPDATE orders SET status = ? WHERE order_id = ?`;
  
  db.query(updateSql, [status, order_id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Order not found' });
    
    const updateShopkeeperOrdersSql = `UPDATE shopkeeper_orders SET status = ? WHERE order_id = ?`;
    db.query(updateShopkeeperOrdersSql, [status, order_id]);
    
    const historySql = `
      INSERT INTO order_status_history 
      (order_id, status, note, updated_by)
      VALUES (?, ?, ?, 'admin')
    `;
    
    db.query(historySql, [order_id, status, note || `Status updated to ${status} by admin`], (err) => {
      if (err) console.error('Error saving history:', err);
      
      res.json({ 
        message: `Order status updated to ${status}`,
        updated: true
      });
    });
  });
});

app.put("/api/admin/orders/:order_id/payment", authenticateAdmin, (req, res) => {
  const { order_id } = req.params;
  const { payment_status } = req.body;

  const validStatuses = ['pending', 'paid', 'failed'];
  
  if (!validStatuses.includes(payment_status)) {
    return res.status(400).json({ 
      message: 'Invalid payment status. Allowed: ' + validStatuses.join(', ') 
    });
  }

  const updateSql = `UPDATE orders SET payment_status = ? WHERE order_id = ?`;
  
  db.query(updateSql, [payment_status, order_id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Order not found' });
    
    res.json({ 
      message: `Payment status updated to ${payment_status}`,
      updated: true
    });
  });
});

app.delete("/api/admin/customers/:id", authenticateAdmin, (req, res) => {
  const customerId = req.params.id;
  
  const checkOrdersSql = `SELECT COUNT(*) as order_count FROM orders WHERE customer_id = ?`;
  
  db.query(checkOrdersSql, [customerId], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    
    if (result[0].order_count > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete customer with order history. Consider disabling instead.' 
      });
    }
    
    db.beginTransaction((err) => {
      if (err) return res.status(500).json({ message: err.message });
      
      const deleteCartSql = `DELETE FROM cart WHERE customer_id = ?`;
      db.query(deleteCartSql, [customerId], (err) => {
        if (err) {
          return db.rollback(() => {
            res.status(500).json({ message: err.message });
          });
        }
        
        const deleteCustomerSql = `DELETE FROM customers WHERE id = ?`;
        db.query(deleteCustomerSql, [customerId], (err, result) => {
          if (err) {
            return db.rollback(() => {
              res.status(500).json({ message: err.message });
            });
          }
          
          if (result.affectedRows === 0) {
            return db.rollback(() => {
              res.status(404).json({ message: 'Customer not found' });
            });
          }
          
          db.commit((err) => {
            if (err) {
              return db.rollback(() => {
                res.status(500).json({ message: err.message });
              });
            }
            
            res.json({ 
              message: 'Customer deleted successfully',
              deleted: true
            });
          });
        });
      });
    });
  });
});

app.get("/api/admin/advanced-stats", authenticateAdmin, (req, res) => {
  const { start_date, end_date } = req.query;
  
  let dateWhereClause = '';
  let params = [];
  
  if (start_date && end_date) {
    dateWhereClause = 'WHERE DATE(created_at) BETWEEN ? AND ?';
    params.push(start_date, end_date);
  } else if (start_date) {
    dateWhereClause = 'WHERE DATE(created_at) >= ?';
    params.push(start_date);
  } else if (end_date) {
    dateWhereClause = 'WHERE DATE(created_at) <= ?';
    params.push(end_date);
  }
  
  const statsQueries = {
    daily_stats: `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as orders_count,
        COALESCE(SUM(total_amount), 0) as daily_revenue,
        AVG(total_amount) as avg_order_value
      FROM orders
      ${dateWhereClause}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `,
    
    top_products: `
      SELECT 
        p.pname,
        p.category,
        p.image,
        s.shop_name,
        SUM(oi.quantity) as total_sold,
        COALESCE(SUM(oi.subtotal), 0) as total_revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.p_id
      JOIN shopkeepers s ON p.shopkeeper_id = s.id
      JOIN orders o ON oi.order_id = o.order_id
      ${dateWhereClause ? dateWhereClause.replace('created_at', 'o.created_at') : ''}
      GROUP BY p.p_id
      ORDER BY total_sold DESC
      LIMIT 10
    `,
    
    top_customers: `
      SELECT 
        c.id,
        c.full_name,
        c.email,
        c.mobile,
        COUNT(o.order_id) as orders_count,
        COALESCE(SUM(o.total_amount), 0) as total_spent
      FROM customers c
      LEFT JOIN orders o ON c.id = o.customer_id
      ${dateWhereClause ? dateWhereClause.replace('created_at', 'o.created_at') : ''}
      GROUP BY c.id
      HAVING orders_count > 0
      ORDER BY total_spent DESC
      LIMIT 10
    `,
    
    top_shopkeepers: `
      SELECT 
        s.id,
        s.shop_name,
        s.full_name,
        s.email,
        COUNT(DISTINCT so.order_id) as orders_count,
        COALESCE(SUM(so.subtotal), 0) as total_sales,
        COUNT(DISTINCT p.p_id) as products_count
      FROM shopkeepers s
      LEFT JOIN shopkeeper_orders so ON s.id = so.shopkeeper_id
      LEFT JOIN products p ON s.id = p.shopkeeper_id
      LEFT JOIN orders o ON so.order_id = o.order_id
      ${dateWhereClause ? dateWhereClause.replace('created_at', 'o.created_at') : ''}
      GROUP BY s.id
      HAVING total_sales > 0
      ORDER BY total_sales DESC
      LIMIT 10
    `,
    
    category_sales: `
      SELECT 
        p.category,
        COUNT(DISTINCT oi.order_id) as orders_count,
        SUM(oi.quantity) as items_sold,
        COALESCE(SUM(oi.subtotal), 0) as total_revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.p_id
      JOIN orders o ON oi.order_id = o.order_id
      ${dateWhereClause ? dateWhereClause.replace('created_at', 'o.created_at') : ''}
      GROUP BY p.category
      ORDER BY total_revenue DESC
    `
  };
  
  const results = {};
  let queryCount = 0;
  const totalQueries = Object.keys(statsQueries).length;
  
  Object.keys(statsQueries).forEach(key => {
    db.query(statsQueries[key], params, (err, queryResults) => {
      if (err) {
        console.error(`Error in ${key} query:`, err);
        results[key] = [];
      } else {
        results[key] = queryResults;
      }
      
      queryCount++;
      
      if (queryCount === totalQueries) {
        res.json(results);
      }
    });
  });
});

/* ================= ADDITIONAL UTILITY ENDPOINTS ================= */
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

app.get("/admin-dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin-dashboard.html"));
});

app.get("/shopkeeper-dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public/shopkeeper-dashboard.html"));
});

/* ================= 404 HANDLER ================= */
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public/index.html"));
});

/* ================= START SERVER ================= */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
}).on('error', (err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});