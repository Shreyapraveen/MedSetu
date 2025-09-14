const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { format } = require("fast-csv");

const app = express();
const PORT = 3000;
const SECRET_KEY = "hackathonSecret123";

app.use(cors());
app.use(express.json());

// ------------------------
// Data paths
const dataDir = path.join(__dirname, "..", "data"); // go up one level from backend
const namasteFile = path.join(dataDir, "namaste.json");
const usersFile = path.join(dataDir, "users.json");
const recordsFile = path.join(dataDir, "records.json");
const loginFile = path.join(dataDir, "login-transactions.json");

// Ensure data files exist
if (!fs.existsSync(namasteFile) || !fs.existsSync(usersFile) || !fs.existsSync(recordsFile)) {
    console.error("Missing data files. Ensure data/ folder has namaste.json, users.json, records.json");
    process.exit(1);
}

// Load data
const namasteData = JSON.parse(fs.readFileSync(namasteFile, "utf8"));
let usersData = JSON.parse(fs.readFileSync(usersFile, "utf8"));
let patientRecords = JSON.parse(fs.readFileSync(recordsFile, "utf8"));

// Load or init login transactions
let loginTransactions = [];
if (fs.existsSync(loginFile)) loginTransactions = JSON.parse(fs.readFileSync(loginFile, "utf8"));

// ------------------------
// Helper functions
function writeRecordsFile() {
    fs.writeFileSync(recordsFile, JSON.stringify(patientRecords, null, 2), "utf8");
}
function writeLoginFile() {
    fs.writeFileSync(loginFile, JSON.stringify(loginTransactions, null, 2), "utf8");
}

// ------------------------
// JWT middleware
function authenticate(req, res, next) {
    const header = req.headers["authorization"];
    if (!header) return res.status(401).json({ message: "No token provided" });

    const token = header.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token" });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).json({ message: "Invalid token" });
        req.user = decoded;
        next();
    });
}

// ------------------------
// Health check
app.get("/health", (req, res) => res.json({ status: "ok", now: new Date().toISOString() }));

// ------------------------
// Autocomplete NAMASTE
// ------------------------
// Autocomplete NAMASTE (fixed)
app.get("/autocomplete", (req, res) => {
    const q = (req.query.q || "").toLowerCase().trim();
    if (!q) return res.json([]);

    const matches = namasteData.filter(item => {
        return item.display && item.display.toLowerCase().includes(q);
    });

    res.json(matches);
});


// ------------------------
// LOGIN ✅ FIXED
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    const user = usersData.find(u => u.username === username && u.password === password);

    // Save login transaction
    const entry = { id: uuidv4(), username, success: !!user, timestamp: new Date().toISOString() };
    loginTransactions.push(entry);
    writeLoginFile();

    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    // Create JWT token
    const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: "2h" });

    // ✅ FIXED: ensure we send user info exactly as frontend expects
    res.json({
        token,
        user: {
            id: user.id,
            username: user.username,
            role: user.role,
            name: user.name || ""
        }
    });
});

// ------------------------
// PROFILE
app.get("/profile", authenticate, (req, res) => {
    const user = usersData.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const { password, ...safe } = user;
    res.json(safe);
});

// ------------------------
// DOCTOR: Get all patients
app.get("/patients", authenticate, (req, res) => {
    if (req.user.role !== "doctor") return res.status(403).json({ message: "Forbidden" });
    const patients = usersData.filter(u => u.role === "patient").map(({ password, ...safe }) => safe);
    res.json(patients);
});

// DOCTOR: Get all doctors
app.get("/doctors", authenticate, (req, res) => {
    if (req.user.role !== "doctor") return res.status(403).json({ message: "Forbidden" });
    const doctors = usersData.filter(u => u.role === "doctor").map(({ password, ...safe }) => safe);
    res.json(doctors);
});

// ------------------------
// RECORDS
app.get("/patients/:id/records", authenticate, (req, res) => {
    const patientId = req.params.id;
    if (req.user.role === "patient" && req.user.id !== patientId)
        return res.status(403).json({ message: "Forbidden" });

    const records = patientRecords
        .filter(r => r.patient_id === patientId)
        .map(r => {
            const namaste = namasteData.find(n => n.code === r.namaste_code) || {};
            return { ...r, icd11_tm2: namaste.icd11_tm2 || "-", icd11_biomed: namaste.icd11_biomed || "-" };
        });

    res.json(records);
});

// ADD record (doctor only)
app.put("/patients/:id/records", authenticate, (req, res) => {
    if (req.user.role !== "doctor") return res.status(403).json({ message: "Forbidden" });
    const { namaste_code, note } = req.body;
    if (!namaste_code || !note) return res.status(400).json({ message: "Missing fields" });

    const namaste = namasteData.find(n => n.code === namaste_code);
    const newRecord = {
        id: uuidv4(),
        patient_id: req.params.id,
        doctor_id: req.user.id,
        namaste_code,
        note,
        icd11_tm2: namaste?.icd11_tm2 || "-",
        icd11_biomed: namaste?.icd11_biomed || "-",
        createdAt: new Date().toISOString()
    };

    patientRecords.push(newRecord);
    writeRecordsFile();
    res.json({ saved: true, record: newRecord });
});

// ------------------------
// PATIENT: Get assigned doctor
app.get("/patients/:id/doctor", authenticate, (req, res) => {
    const patientId = req.params.id;
    if (req.user.role === "patient" && req.user.id !== patientId)
        return res.status(403).json({ message: "Forbidden" });

    const record = patientRecords.find(r => r.patient_id === patientId);
    if (!record) return res.status(404).json({ message: "No doctor assigned yet" });

    const doctor = usersData.find(u => u.id === record.doctor_id);
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });

    const { password, ...safe } = doctor;
    res.json(safe);
});

// ------------------------
// PATIENT: View insurance
app.get("/patients/:id/insurance", authenticate, (req, res) => {
    const patientId = req.params.id;
    if (req.user.role === "patient" && req.user.id !== patientId)
        return res.status(403).json({ message: "Forbidden" });

    const insurance = {
        provider: "HealthCare Co.",
        policyNumber: `POL-${patientId.toUpperCase()}`,
        validTill: "2026-12-31",
        coverage: "General + Specialist"
    };
    res.json(insurance);
});

// ------------------------
// ADMIN: Login transactions
app.get("/admin/login-transactions", authenticate, (req, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    res.json(loginTransactions);
});

// ADMIN: Download CSV
app.get("/admin/login-transactions/csv", authenticate, (req, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    res.setHeader("Content-Disposition", "attachment; filename=login-transactions.csv");
    res.setHeader("Content-Type", "text/csv");

    const csvStream = format({ headers: true });
    csvStream.pipe(res);
    loginTransactions.forEach(tx => csvStream.write(tx));
    csvStream.end();
});

// ------------------------
// 404 catch
app.use((req, res) => res.status(404).json({ message: "Endpoint not found" }));

// ------------------------
// Start server
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
