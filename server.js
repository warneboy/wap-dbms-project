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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const JWT_SECRET = "supersecretkey";

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= STATIC FILES =================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(__dirname));

// ================= UPLOADS FOLDER =================
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// ================= MULTER CONFIG =================
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    cb(null, "temp_" + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ================= MYSQL CONNECTION =================
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Nprotter@123",
  database: "dreambasket"
});

db.connect(err => {
  if (err) throw err;
  console.log("MySQL Connected");
});

// ================= ID GENERATORS =================
function generateUserId(table, prefix, callback) {
  db.query(
    `SELECT id FROM ${table} ORDER BY CAST(SUBSTRING(id,2) AS UNSIGNED) DESC LIMIT 1`,
    (err, rows) => {
      if (err) return callback(err);
      if (!rows.length) return callback(null, prefix === "C" ? "C11111" : "S1111");

      const next = parseInt(rows[0].id.substring(1)) + 1;
      callback(null, prefix + next);
    }
  );
}

function generateProductId(callback) {
  const sql = `
    SELECT p_id 
    FROM products 
    ORDER BY CAST(SUBSTRING(p_id,2) AS UNSIGNED) DESC 
    LIMIT 1
  `;

  db.query(sql, (err, rows) => {
    if (err) return callback(err);
    if (!rows.length) return callback(null, "P1111");

    const num = parseInt(rows[0].p_id.match(/\d+/)[0]) + 1;
    callback(null, "P" + num);
  });
}

// ================= SIGNUP =================
app.post("/signup", upload.single("citizenship"), async (req, res) => {
  try {
    const {
      role, full_name, email, mobile,
      password, shop_name, shop_address, registration_no
    } = req.body;

    if (!role || !full_name || !email || !password)
      return res.status(400).json({ message: "Missing fields" });

    const hashed = await bcrypt.hash(password, 10);

    const checkEmail = `
      SELECT email FROM customers WHERE email=?
      UNION
      SELECT email FROM shopkeepers WHERE email=?
    `;

    db.query(checkEmail, [email, email], (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      if (rows.length) return res.status(409).json({ message: "Email exists" });

      if (role === "customer") {
        generateUserId("customers", "C", (err, id) => {
          if (err) return res.status(500).json({ message: err.message });

          db.query(
            "INSERT INTO customers VALUES (?,?,?,?,?)",
            [id, full_name, email, mobile, hashed],
            err => {
              if (err) return res.status(500).json({ message: err.message });
              res.json({ message: "Customer registered", id });
            }
          );
        });
      }

      if (role === "shopkeeper") {
        generateUserId("shopkeepers", "S", (err, id) => {
          if (err) return res.status(500).json({ message: err.message });

          let image = null;
          if (req.file) {
            image = id + path.extname(req.file.originalname);
            fs.renameSync(
              path.join(uploadsDir, req.file.filename),
              path.join(uploadsDir, image)
            );
          }

          db.query(
            `INSERT INTO shopkeepers
            VALUES (?,?,?,?,?,?,?,?,?)`,
            [
              id, full_name, email, mobile, hashed,
              shop_name, shop_address, registration_no, image
            ],
            err => {
              if (err) return res.status(500).json({ message: err.message });
              res.json({ message: "Shopkeeper registered", id });
            }
          );
        });
      }
    });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// ================= LOGIN =================
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM customers WHERE email=?", [email], async (err, rows) => {
    if (rows?.length) {
      const user = rows[0];
      if (!(await bcrypt.compare(password, user.password)))
        return res.status(401).json({ message: "Invalid credentials" });

      const token = jwt.sign({ id: user.id, role: "customer" }, JWT_SECRET, { expiresIn: "1d" });
      return res.json({ role: "customer", token, user });
    }

    db.query("SELECT * FROM shopkeepers WHERE email=?", [email], async (err, rows) => {
      if (!rows.length) return res.status(404).json({ message: "Not found" });

      const user = rows[0];
      if (!(await bcrypt.compare(password, user.password)))
        return res.status(401).json({ message: "Invalid credentials" });

      const token = jwt.sign({ id: user.id, role: "shopkeeper" }, JWT_SECRET, { expiresIn: "1d" });
      res.json({ role: "shopkeeper", token, user });
    });
  });
});

// ================= ADD PRODUCT =================
app.post("/add-product", upload.single("image"), (req, res) => {
  const { pname, description, category, price, discount, sizes, quantity } = req.body;
  if (!pname || !category || !price || !sizes || !req.file)
    return res.status(400).json({ message: "Missing product data" });

  const shop_id = "S1111"; // replace with JWT later

  generateProductId((err, basePid) => {
    if (err) return res.status(500).json({ message: err.message });

    const imageName = basePid + path.extname(req.file.originalname);
    fs.renameSync(
      path.join(uploadsDir, req.file.filename),
      path.join(uploadsDir, imageName)
    );

    const sizeArray = Array.isArray(sizes) ? sizes : [sizes];

    sizeArray.forEach(size => {
      const pid = `${basePid}-${size}`;
      const qty = quantity?.[size] || 0;

      db.query(
        `INSERT INTO products
        (p_id, shop_id, pname, description, category, size, price, discount, quantity, image)
        VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          pid, shop_id, pname, description, category,
          size, price, discount || 0, qty, imageName
        ]
      );
    });

    res.json({ message: "Product added", product_id: basePid });
  });
});

// ================= GET PRODUCTS =================
app.get("/products", (req, res) => {
  const sql = `
    SELECT 
      p_id, pname, description, category, size, price, discount, quantity, image, created_at
    FROM products
    WHERE quantity > 0
    ORDER BY created_at DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(rows);
  });
});


// ================= SERVE HTML =================
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);

app.get("/upload", (req, res) =>
  res.sendFile(path.join(__dirname, "upload.html"))
);

// ================= START SERVER =================
app.listen(3000, () =>
  console.log("Server running at http://localhost:3000")
);
