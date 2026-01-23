const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const JWT_SECRET = "supersecretkey";

// ========== MIDDLEWARE ==========
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ========== UPLOADS FOLDER ==========
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// ========== MULTER CONFIG ==========
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) =>
    cb(null, "temp_" + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ========== MYSQL CONNECTION ==========
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

// ========== ID GENERATOR ==========
function generateId(table, prefix, callback) {
  db.query(`SELECT id FROM ${table} ORDER BY id DESC LIMIT 1`, (err, rows) => {
    if (err) return callback(err);
    if (rows.length === 0)
      return callback(null, prefix === "C" ? "C11111" : "S1111");

    const num = parseInt(rows[0].id.substring(1)) + 1;
    callback(null, prefix + num);
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
      return res.status(400).json({ message: "Missing required fields" });

    const hashed = await bcrypt.hash(password, 10);

    const checkEmail = `
      SELECT email FROM customers WHERE email=?
      UNION
      SELECT email FROM shopkeepers WHERE email=?
    `;
    db.query(checkEmail, [email, email], (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      if (rows.length) return res.status(409).json({ message: "Email already exists" });

      if (role === "customer") {
        generateId("customers", "C", (err, id) => {
          if (err) return res.status(500).json({ message: err.message });

          db.query(
            "INSERT INTO customers (id, full_name, email, mobile, password) VALUES (?,?,?,?,?)",
            [id, full_name, email, mobile, hashed],
            err => {
              if (err) return res.status(500).json({ message: err.message });
              res.json({ message: "Customer registered", id });
            }
          );
        });
      } else if (role === "shopkeeper") {
        generateId("shopkeepers", "S", (err, id) => {
          if (err) return res.status(500).json({ message: err.message });

          let image = null;
          if (req.file) {
            image = id + path.extname(req.file.originalname);
            fs.renameSync(`uploads/${req.file.filename}`, `uploads/${image}`);
          }

          db.query(
            `INSERT INTO shopkeepers
            (id, full_name, email, mobile, password, shop_name, shop_address, registration_no, citizenship_image)
            VALUES (?,?,?,?,?,?,?,?,?)`,
            [id, full_name, email, mobile, hashed, shop_name, shop_address, registration_no, image],
            err => {
              if (err) return res.status(500).json({ message: err.message });
              res.json({ message: "Shopkeeper registered", id });
            }
          );
        });
      }
    });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// ================= LOGIN =================
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) return res.status(400).json({ message: "Email and password required" });

  // Check customers first
  db.query("SELECT * FROM customers WHERE email=?", [email], async (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });

    if (rows.length) {
      try {
        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ message: "Invalid credentials" });

        const token = jwt.sign({ id: user.id, role: "customer" }, JWT_SECRET, { expiresIn: "1d" });

        return res.json({
          message: "Login successful",
          role: "customer",
          token,
          user: {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            mobile: user.mobile
          }
        });
      } catch (e) {
        return res.status(500).json({ message: "Server error" });
      }
    }

    // Check shopkeepers
    db.query("SELECT * FROM shopkeepers WHERE email=?", [email], async (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      if (!rows.length) return res.status(404).json({ message: "Account not found" });

      try {
        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ message: "Invalid credentials" });

        const token = jwt.sign({ id: user.id, role: "shopkeeper" }, JWT_SECRET, { expiresIn: "1d" });

        return res.json({
          message: "Login successful",
          role: "shopkeeper",
          token,
          user: {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            mobile: user.mobile
          }
        });
      } catch (e) {
        return res.status(500).json({ message: "Server error" });
      }
    });
  });
});

// ================= CHECK EMAIL =================
app.post("/check-email", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  const query = `
    SELECT email FROM customers WHERE email=?
    UNION
    SELECT email FROM shopkeepers WHERE email=?
  `;
  db.query(query, [email, email], (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    if (rows.length === 0) return res.status(404).json({ message: "Email does not exist" });
    res.json({ message: "Email exists" });
  });
});

// ================= GET CUSTOMERS =================
app.get("/users", (req, res) => {
  const sql = "SELECT id, full_name, email, mobile FROM customers";
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(result);
  });
});

// ================= SERVER =================
app.listen(3000, () => console.log("Server running at http://localhost:3000"));
