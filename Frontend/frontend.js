// ------------------------
// LOGIN FUNCTION
async function login() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const output = document.getElementById("loginOutput");
    output.innerText = "";
    output.style.color = "red";

    if (!username || !password) {
        output.innerText = "Please enter both username and password!";
        return;
    }

    try {
        const res = await fetch("http://localhost:3000/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (!res.ok) {
            output.innerText = data.message || "Login failed!";
            return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.user.role);
        localStorage.setItem("username", data.user.username);
        localStorage.setItem("userId", data.user.id);

        output.style.color = "green";
        output.innerText = "Login successful! Redirecting...";

        setTimeout(() => window.location.href = "dashboard.html", 1000);
    } catch (err) {
        output.innerText = "Error: " + err.message;
    }
}

// ------------------------
// LOGOUT
function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}

// ------------------------
// HELPER: Render table
function renderTable(data, columns) {
    const output = document.getElementById("output");
    if (!data || !data.length) {
        output.innerHTML = "<p>No data found.</p>";
        return;
    }

    let html = "<div style='overflow-x:auto;'><table class='table table-striped table-bordered table-sm'>";
    html += "<thead class='table-dark'><tr>";
    columns.forEach(col => html += `<th>${col}</th>`);
    html += "</tr></thead><tbody>";

    data.forEach(row => {
        html += "<tr>";
        columns.forEach(col => html += `<td>${row[col] ?? "-"}</td>`);
        html += "</tr>";
    });

    html += "</tbody></table></div>";
    output.innerHTML = html;
}

// ------------------------
// DASHBOARD ROLE-BASED VIEW
window.addEventListener("DOMContentLoaded", () => {
    
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    const username = localStorage.getItem("username");

    // Prevent redirect loop on index.html
    // Prevent redirect loop
if (
    !token &&
    !window.location.href.includes("index.html") &&
    !window.location.href.includes("login.html")
) {
    window.location.href = "index.html";
}


    const welcomeMsg = document.getElementById("welcomeMsg");
    if (welcomeMsg) welcomeMsg.innerText = `Hello, ${username || "Guest"}!`;

    const doctorSection = document.getElementById("doctorSection");
    const patientSection = document.getElementById("patientSection");
    const adminSection = document.getElementById("adminSection");

    if (role === "doctor") doctorSection?.classList.remove("hidden");
    else if (role === "patient") patientSection?.classList.remove("hidden");
    else if (role === "admin") adminSection?.classList.remove("hidden");

    // Reset patient input
    if (role === "doctor") {
        const patientIdInput = document.getElementById("patientId");
        if (patientIdInput) patientIdInput.value = "";
    }
});

// ------------------------
// DOCTOR FUNCTIONS
async function getPatients() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch("http://localhost:3000/patients", { headers: { "Authorization": `Bearer ${token}` } });
        const data = await res.json();
        renderTable(data, ["id", "username", "name", "role"]);
    } catch (err) { document.getElementById("output").innerText = "Error: " + err.message; }
}

async function getDoctors() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch("http://localhost:3000/doctors", { headers: { "Authorization": `Bearer ${token}` } });
        const data = await res.json();
        renderTable(data, ["id", "username", "name", "role"]);
    } catch (err) { document.getElementById("output").innerText = "Error: " + err.message; }
}

async function viewProfile() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch("http://localhost:3000/profile", { headers: { "Authorization": `Bearer ${token}` } });
        const data = await res.json();
        renderTable([data], Object.keys(data));
    } catch (err) { document.getElementById("output").innerText = "Error: " + err.message; }
}

async function fetchRecords() {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    let id = localStorage.getItem("userId");

    if (role === "doctor") {
        const patientIdInput = document.getElementById("patientId");
        if (patientIdInput && patientIdInput.value.trim()) id = patientIdInput.value.trim();
    }

    try {
        const res = await fetch(`http://localhost:3000/patients/${id}/records`, { headers: { "Authorization": `Bearer ${token}` } });
        const data = await res.json();
        renderTable(data, ["id", "patient_id", "doctor_id", "namaste_code", "icd11_tm2", "icd11_biomed", "note", "createdAt"]);
    } catch (err) { document.getElementById("output").innerText = "Error: " + err.message; }
}

async function addRecord() {
    const token = localStorage.getItem("token");
    const patientId = document.getElementById("patientId")?.value.trim();
    const namaste_code = document.getElementById("namasteCode")?.value.trim();
    const note = document.getElementById("note")?.value.trim();

    if (!patientId || !namaste_code || !note) {
        document.getElementById("output").innerText = "Please fill patient ID, NAMASTE code, and note.";
        return;
    }

    try {
        const res = await fetch(`http://localhost:3000/patients/${patientId}/records`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ namaste_code, note })
        });
        await res.json();
        document.getElementById("output").innerText = "Record added successfully!";
        fetchRecords();
    } catch (err) { document.getElementById("output").innerText = "Error: " + err.message; }
}

// ------------------------
// PATIENT FUNCTIONS
async function viewDoctor() {
    const token = localStorage.getItem("token");
    const id = localStorage.getItem("userId");
    try {
        const res = await fetch(`http://localhost:3000/patients/${id}/doctor`, { headers: { "Authorization": `Bearer ${token}` } });
        const data = await res.json();
        renderTable([data], Object.keys(data));
    } catch (err) { document.getElementById("output").innerText = "Error: " + err.message; }
}

async function viewInsurance() {
    const token = localStorage.getItem("token");
    const id = localStorage.getItem("userId");
    try {
        const res = await fetch(`http://localhost:3000/patients/${id}/insurance`, { headers: { "Authorization": `Bearer ${token}` } });
        const data = await res.json();
        renderTable([data], Object.keys(data));
    } catch (err) { document.getElementById("output").innerText = "Error: " + err.message; }
}

// ------------------------
// ADMIN FUNCTIONS
async function viewLoginTransactions() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch("http://localhost:3000/admin/login-transactions", { headers: { "Authorization": `Bearer ${token}` } });
        const data = await res.json();
        renderTable(data, ["id", "username", "success", "timestamp"]);
    } catch (err) { document.getElementById("output").innerText = "Error: " + err.message; }
}

async function downloadLoginCSV() {
    const token = localStorage.getItem("token");

    try {
        const res = await fetch("http://localhost:3000/admin/login-transactions/csv", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Failed to download CSV");

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "login-transactions.csv"; // File name
        document.body.appendChild(a);
        a.click();

        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        document.getElementById("output").innerText = "Error downloading CSV: " + err.message;
    }
}


// ------------------------
// DIAGNOSTIC SEARCH
async function autocomplete() {
    const q = document.getElementById("diseaseQuery").value.trim();
    const output = document.getElementById("output");
    if (!q) { output.innerText = "Enter a disease or code."; return; }

    try {
        const res = await fetch(`http://localhost:3000/autocomplete?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!data.length) { output.innerText = "No results found."; return; }
        renderTable(data, ["display", "code", "icd11_tm2", "icd11_biomed"]);
    } catch (err) { output.innerText = "Error: " + err.message; }
}
