import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from './db';

// --- SETUP ---
const app = express();
const port = 4000;

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer setup for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());
// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(uploadDir));


// --- API ENDPOINTS ---

// 1. Create a new prescription
app.post('/api/prescriptions', upload.single('prescriptionImage'), async (req, res) => {
  try {
    const { patientName, patientAge, authorId } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Prescription image is required.' });
    }
    if (!patientName || !patientAge || !authorId) {
      return res.status(400).json({ error: 'Patient name, age, and authorId are required.' });
    }

    // Find or create the patient
    let patient = await prisma.patient.findFirst({ where: { name: patientName } });
    if (!patient) {
      patient = await prisma.patient.create({
        data: { name: patientName, age: parseInt(patientAge, 10) },
      });
    }

    const newPrescription = await prisma.prescription.create({
      data: {
        patientId: patient.id,
        authorId: authorId, // We will replace this with real auth later
        prescriptionImageUrl: `/uploads/${req.file.filename}`, // URL path to the image
      },
    });

    res.status(201).json(newPrescription);
  } catch (error) {
    console.error('Failed to create prescription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Get all pending prescriptions
app.get('/api/prescriptions/pending', async (req, res) => {
  try {
    const pendingPrescriptions = await prisma.prescription.findMany({
      where: { status: 'PENDING' },
      include: { patient: true }, // Include patient details
      orderBy: { createdAt: 'desc' },
    });
    res.json(pendingPrescriptions);
  } catch (error) {
    console.error('Failed to get pending prescriptions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Mark a prescription as dispensed
app.patch('/api/prescriptions/:id/dispense', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedPrescription = await prisma.prescription.update({
      where: { id: id },
      data: { status: 'DISPENSED' },
    });
    res.json(updatedPrescription);
  } catch (error) {
    console.error('Failed to update prescription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- START SERVER ---
app.listen(port, () => {
  console.log(`🚀 Server listening at http://localhost:${port}`);
});