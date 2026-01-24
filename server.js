// server.js
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
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // serve uploaded images
app.use(express.static(__dirname)); // serve HTML, CSS, JS, images

// ================= UPLOADS FOLDER =================
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// ================= MULTER CONFIG =================
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) =>
    cb(null, "temp_" + Date.now() + path.extname(file.originalname))
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

// ================= ID GENERATOR =================
function generateId(table, prefix, callback) {
  db.query(`SELECT id FROM ${table} ORDER BY id DESC LIMIT 1`, (err, rows) => {
    if (err) return callback(err);
    if (rows.length === 0) return callback(null, prefix === "C" ? "C11111" : "S1111");

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
            fs.renameSync(
              path.join(uploadsDir, req.file.filename),
              path.join(uploadsDir, image)
            );
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

  db.query("SELECT * FROM customers WHERE email=?", [email], async (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });

    if (rows.length) {
      const user = rows[0];
      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ message: "Invalid credentials" });

      const token = jwt.sign({ id: user.id, role: "customer" }, JWT_SECRET, { expiresIn: "1d" });
      return res.json({ message: "Login successful", role: "customer", token, user });
    }

    db.query("SELECT * FROM shopkeepers WHERE email=?", [email], async (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      if (!rows.length) return res.status(404).json({ message: "Account not found" });

      const user = rows[0];
      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ message: "Invalid credentials" });

      const token = jwt.sign({ id: user.id, role: "shopkeeper" }, JWT_SECRET, { expiresIn: "1d" });
      return res.json({ message: "Login successful", role: "shopkeeper", token, user });
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

// ================= GET USERS =================
app.get("/users", (req, res) => {
  db.query("SELECT id, full_name, email, mobile FROM customers", (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(result);
  });
});

// ================= GET IMAGES =================
app.get("/images", (req, res) => {
  fs.readdir(uploadsDir, (err, files) => {
    if (err) return res.status(500).json({ message: "Cannot read uploads folder" });
    const images = files.filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file));
    res.json(images);
  });
});

// ================= DELETE SHOPKEEPER (SAFE FILE DELETE) =================
app.delete("/shopkeeper/:id", (req, res) => {
  const { id } = req.params;

  db.query("SELECT citizenship_image FROM shopkeepers WHERE id=?", [id], (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    if (rows.length === 0) return res.status(404).json({ message: "Shopkeeper not found" });

    const fileName = rows[0].citizenship_image;

    // Delete file only if it exists
    if (fileName) {
      const filePath = path.join(uploadsDir, fileName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    db.query("DELETE FROM shopkeepers WHERE id=?", [id], (err, result) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json({ message: "Shopkeeper deleted successfully" });
    });
  });
});

// ================= SERVE HTML =================
app.get("/upload", (req, res) => res.sendFile(path.join(__dirname, "upload.html")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

// ================= START SERVER =================
app.listen(3000, () => console.log("Server running at http://localhost:3000"));
