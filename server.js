const express = require('express');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// MySQL Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect(err => {
    if (err) {
        console.error('Database connection failed: ' + err.stack);
        return;
    }
    console.log('Connected to MySQL Database.');
});

// Simple API to get Profile Data
app.get('/api/profile', (req, res) => {
    db.query('SELECT * FROM profile LIMIT 1', (err, results) => {
        if (err) throw err;
        res.json(results[0]);
    });
});

app.listen(process.env.PORT, () => {
    console.log(`Server running on http://localhost:${process.env.PORT}`);
});

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure storage for PDFs
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads/certificates';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// API to Upload Certificate
// We will just store the PDF path. 
// We'll use a cool CSS "Mini-Preview" on the frontend instead of a broken image library.
app.post('/api/certificates', upload.single('pdf'), (req, res) => {
    const { title } = req.body;
    const pdfPath = req.file.path.replace(/\\/g, "/"); // Fix Windows slashes

    const sql = 'INSERT INTO certificates (title, pdf_path) VALUES (?, ?)';
    db.query(sql, [title, pdfPath], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json({ message: 'Certificate saved!' });
    });
});

// API to Get All Certificates
app.get('/api/certificates', (req, res) => {
    db.query('SELECT * FROM certificates', (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// API to Delete Certificate
app.delete('/api/certificates/:id', (req, res) => {
    const id = req.params.id;
    // First, get the path to delete the physical file
    db.query('SELECT pdf_path FROM certificates WHERE id = ?', [id], (err, results) => {
        if (results.length > 0) {
            fs.unlinkSync(results[0].pdf_path); // Deletes file from folder
            db.query('DELETE FROM certificates WHERE id = ?', [id], (err) => {
                if (err) throw err;
                res.json({ message: 'Deleted successfully' });
            });
        }
    });
});

// Make the uploads folder public so we can view the PDFs
app.use('/uploads', express.static('uploads'));

// --- PROJECT ROUTES ---

// 1. Get all projects from MySQL
app.get('/api/projects', (req, res) => {
    const sql = 'SELECT * FROM projects';
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching projects:", err);
            return res.status(500).send(err);
        }
        res.json(results);
    });
});

// 2. Save a new project to MySQL
app.post('/api/projects', (req, res) => {
    const { title, description, link } = req.body;
    const sql = 'INSERT INTO projects (title, description, link) VALUES (?, ?, ?)';
    db.query(sql, [title, description, link], (err, result) => {
        if (err) {
            console.error("Error saving project:", err);
            return res.status(500).send(err);
        }
        res.json({ message: 'Project saved!', id: result.insertId });
    });
});

// --- WORK EXPERIENCE ROUTES ---

// 1. Get all experience from MySQL
app.get('/api/experience', (req, res) => {
    const sql = 'SELECT * FROM work_experience ORDER BY id DESC';
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// 2. Add new experience with optional media
app.post('/api/experience', upload.single('media'), (req, res) => {
    const { company, role, duration, description } = req.body;
    const mediaPath = req.file ? req.file.path.replace(/\\/g, "/") : null;

    const sql = 'INSERT INTO work_experience (company_name, role, duration, description, media_path) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [company, role, duration, description, mediaPath], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Experience added!', id: result.insertId });
    });
});

// 3. Delete experience
app.delete('/api/experience/:id', (req, res) => {
    const id = req.params.id;
    db.query('DELETE FROM work_experience WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Deleted successfully' });
    });
});