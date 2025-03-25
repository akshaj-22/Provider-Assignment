const express = require('express');
const router = express.Router();
const Consultation = require('../models/consultation');
const Provider = require('../models/provider');
const Patient = require('../models/patient');
const Notification = require('../models/notification');
const PatientDocument = require('../models/patientDocument')
const { sendEmailNotification } = require('../utils/emailService');
const AWS = require("aws-sdk");
const multer = require("multer");
const sharp = require("sharp");
require("dotenv").config();

// Configure Multer to store files in memory
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed!"), false);
    }
    cb(null, true);
  },
});

// Configure AWS S3
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
  });

//Book a consultation for a patient
  router.post('/', async (req, res) => {
    try {
        const { patient_id, date, time, priority } = req.body;

        // Check if patient exists
        const patient = await Patient.findByPk(patient_id);
        if (!patient) return res.status(404).json({ error: "Patient not found" });

        // Find all providers with the required specialization
        const providers = await Provider.findAll({ where: { specialization: patient.reason_for_consultation } });

        if (providers.length === 0) {
            return res.status(404).json({ error: "No providers available for this specialization" });
        }

        // Convert date and time into a comparable format
        const requestedDate = new Date(date).toISOString().split('T')[0];
        const requestedTime = time;

        // Find an available provider
        let assignedProvider = null;

        for (const provider of providers) {
            const existingConsultation = await Consultation.findOne({
                where: { provider_id: provider.id, date: requestedDate, time: requestedTime }
            });

            if (!existingConsultation) {
                assignedProvider = provider;
                break; // Assign the first available provider
            }
        }

        if (!assignedProvider) {
            return res.status(400).json({ error: "All providers are currently busy at this time. Please choose another time." });
        }

        // Create the consultation with the assigned provider
        const consultation = await Consultation.create({
            patient_id,
            provider_id: assignedProvider.id,
            date: requestedDate,
            time: requestedTime,
            status: 'Scheduled',
            priority
        });
        console.log(consultation.date);
        // Create a notification for the assigned provider
        await Notification.create({
            provider_id: assignedProvider.id,
            type: 'consultation',
            message: `New consultation on ${date} at ${time} (Priority: ${priority})`
        });

        // Send email notification to the provider
        await sendEmailNotification(
            assignedProvider.email,
            `New Consultation Scheduled`,
            `Hello Dr. ${assignedProvider.name},\n\nYou have a new consultation scheduled with ${patient.name} on ${date} at ${time}.\n\nPriority: ${priority.toUpperCase()}`
        );

        res.status(201).json({ message: "Consultation booked successfully", consultation });

    } catch (error) {
        console.error(`Error in booking consultation: ${error.message}`);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


//get all consultations
router.get('/', async (req, res) => {
    try {
        const consultations = await Consultation.findAll();
        res.status(200).json(consultations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

//Send reminders for upcoming consultations
router.get('/reminder', async (req, res) => { 
    try {
        // Step 1: Get today's date and format it as YYYY-MM-DD
        const today = new Date();
        const formattedToday = today.toISOString().split('T')[0]; // "YYYY-MM-DD"

        // Step 2: Calculate tomorrow's date in same format
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);
        const formattedTomorrow = tomorrow.toISOString().split('T')[0]; // "YYYY-MM-DD"

        // Step 3: Fetch all consultations
        const consultations = await Consultation.findAll();

        // Step 4: Filter consultations by comparing formatted dates
        const upcomingConsultations = consultations.filter(consultation => {
            const consultationDate = new Date(consultation.date);
            const formattedConsultationDate = consultationDate.toISOString().split('T')[0]; // Format DB date to "YYYY-MM-DD"
            
            return formattedConsultationDate === formattedTomorrow; // ✅ Check if it matches tomorrow's date
        });

        if (upcomingConsultations.length === 0) {
            return res.status(200).json({ message: "No upcoming consultations for tomorrow." });
        }

        for (const consultation of upcomingConsultations) {
            const provider = await Provider.findByPk(consultation.provider_id);
            if (provider) {
                await Notification.create({
                    provider_id: provider.id,
                    type: 'consultation',
                    message: `Reminder: Your upcoming consultation is on ${consultation.date} at ${consultation.time}.`
                });

                await sendEmailNotification(
                    provider.email,
                    `Upcoming Consultation Reminder`,
                    `Hello Dr. ${provider.name},\n\nThis is a reminder that you have a consultation scheduled for tomorrow:\n\nDate: ${consultation.date}\nTime: ${consultation.time}\n\nPlease be prepared.\n\nBest regards,\nYour Consultation Team`
                );
            }
        }

        res.status(200).json({ message: "Reminder emails sent successfully." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


//Reshedule consultation
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { date, time, priority } = req.body;

        // Ensure date is stored as YYYY-MM-DD only
        const formattedDate = new Date(date).toISOString().split('T')[0];

        const consultation = await Consultation.findByPk(id);
        if (!consultation) return res.status(404).json({ error: "Consultation not found" });

        consultation.date = formattedDate;
        consultation.time = time;
        consultation.status = 'Rescheduled'
        consultation.priority = priority;
        await consultation.save();

        const provider = await Provider.findByPk(consultation.provider_id);
        const patient = await Patient.findByPk(consultation.patient_id);
        if (provider) {
            //
            // Create a notification for the assigned provider
        await Notification.create({
            provider_id: provider.id,
            type: 'consultation',
            message: `Consultation updated to ${formattedDate} at ${time} (Priority: ${priority})`
        });

        // Send email notification to the provider
        await sendEmailNotification(
            provider.email,
            `Consultation Rescheduled`,
            `Hello Dr. ${provider.name},\n\nYour consultation is Rescheduled with ${patient.name} on ${consultation.date} at ${consultation.time}.\n\nPriority: ${consultation.priority.toUpperCase()}`
        );
        }

        res.status(200).json({ message: "Consultation updated successfully", consultation });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


//Mark a consultation as missed
router.put("/missed/:consultationId", async (req, res) => {
    try {
      const { consultationId } = req.params;
  
      const consultation = await Consultation.findByPk(consultationId);
      if (!consultation) {
        return res.status(404).json({ error: "Consultation not found" });
      }
  
      if (consultation.status === "Missed") {
        return res.status(400).json({ error: "Consultation is already marked as missed" });
      }
  
      consultation.status = "Missed";
      await consultation.save();
  
      const provider = await Provider.findByPk(consultation.provider_id);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }
  
      await Notification.create({
        provider_id: provider.id,
        type: "consultation",
        message: `A consultation with Patient ID ${consultation.patient_id} on ${consultation.date} at ${consultation.time} was missed.`,
      });
  
      await sendEmailNotification(
        provider.email,
        "Missed Consultation Alert",
        `Hello Dr. ${provider.name},\n\nA scheduled consultation with Patient ID ${consultation.patient_id} on ${consultation.date} at ${consultation.time} was marked as missed.\n\nPlease follow up accordingly.\n\nBest regards,\nYour Healthcare Team`
      );
  
      res.status(200).json({ message: "Consultation marked as missed, provider notified" });
    } catch (error) {
      console.error("Error marking consultation as missed:", error);
      res.status(500).json({ error: error.message });
    }
  });
  

//Upload a patient document to S3 and notify the provider
router.post("/upload", upload.single("document"), async (req, res) => {
    try {
      const { consultation_id, patient_id, date, document_type } = req.body;
  
      if (!req.file) {
        return res.status(400).json({ error: "No document uploaded" });
      }

    // Start processing the image using Sharp with the uploaded file buffer
    let processedImage = sharp(req.file.buffer);

    // Get the processed image as a Buffer
    const processedBuffer = await processedImage.toBuffer();
  
    //   const document_url = req.file.location;
    const s3Key = `images/${Date.now()}-${req.file.originalname}`;

    // Upload the processed image to AWS S3
    const uploadResult = await s3.upload({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: s3Key,
        Body: processedBuffer,
        ContentType: req.file.mimetype,
        ACL: 'public-read', // This makes the file publicly accessible
      }).promise();

    const document_url = uploadResult.Location;
  
      // Fetch provider_id from the Consultation table
      const consultation = await Consultation.findByPk(consultation_id);
      if (!consultation) {
        return res.status(404).json({ error: "Consultation not found" });
      }
  
      const provider_id = consultation.provider_id;
  
      // Save document details to the database
      const newDocument = await PatientDocument.create({
        consultation_id,
        provider_id,
        patient_id,
        date: new Date(date),
        document_type,
        document_url,
      });
  
      // Find provider to send notification
      const provider = await Provider.findByPk(provider_id);
      if (provider) {
        // Create a notification for the provider
        await Notification.create({
          provider_id,
          type: "consultation",
          message: `Patient (ID: ${patient_id}) submitted a ${document_type} for consultation ID ${consultation_id} on ${date}.`,
        });
  
        // Send an email notification to the provider
        await sendEmailNotification(
          provider.email,
          `New Patient Document Submitted`,
          `Hello Dr. ${provider.name},\n\nA new document has been submitted by a patient.\n\nDetails:\nConsultation ID: ${consultation_id}\nDocument Type: ${document_type}\nSubmission Date: ${date}\n\nView document: ${document_url}\n\nBest regards,\nYour Healthcare Team`
        );
      }
  
      res.status(201).json({ message: "Document uploaded successfully", document: newDocument });
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

//Update Consultation Status to Completed
router.put("/:consultation_id/status", async (req, res) => {
  try {
    const { consultation_id } = req.params;

    // Find the consultation
    const consultation = await Consultation.findByPk(consultation_id);
    if (!consultation) {
      return res.status(404).json({ error: "Consultation not found" });
    }

    // Update status
    consultation.status = "Completed";
    await consultation.save();

    res.status(200).json({ message: "Consultation marked as completed", consultation });
  } catch (error) {
    console.error("Error updating consultation status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
 
  
//Get consultation summary for a provider on a given date.
  router.get("/consultation-summary/:provider_id/:date", async (req, res) => {
    try {
      const { provider_id, date } = req.params;
  
      // Convert input date to YYYY-MM-DD format before querying the DB
      const newDate = new Date(date);
  
      // Fetch consultations matching the provider and date
      const consultations = await Consultation.findAll({ 
        where: { provider_id, date: newDate }
      });
  
      if (!consultations.length) {
        return res.status(404).json({ error: "No consultations found for this provider on the given date." });
      }
  
      // Fetch provider details
      const provider = await Provider.findByPk(provider_id);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found." });
      }
  
      // Fetch patient names from the Patient model
      const patientNames = await Promise.all(
        consultations.map(async (consult) => {
          const patient = await Patient.findByPk(consult.patient_id);
          return {
            patientName: patient ? patient.name : "Unknown Patient",
            time: consult.time,
            status: consult.status,
          };
        })
      );
  
      // Construct summary message
      let summary = `Consultation Summary for Dr. ${provider.name} on ${date}\n\n`;
      patientNames.forEach((consult, index) => {
        summary += `#${index + 1}\nPatient: ${consult.patientName}\nTime: ${consult.time}\nStatus: ${consult.status}\n\n`;
      });
  
      // Store notification in the database
      await Notification.create({
        provider_id,
        type: "consultation",
        message: `Your consultation summary for ${date} is available.`,
      });
  
      // Send email notification
      await sendEmailNotification(
        provider.email,
        `Your Consultation Summary for ${date}`,
        `Hello Dr. ${provider.name},\n\nHere is your consultation summary for ${date}:\n\n${summary}\n\nBest regards,\nYour Healthcare Team`
      );
  
      res.json({ message: "Consultation summary sent successfully", summary });
  
    } catch (error) {
      console.error("Error fetching consultation summary:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });


//Delete or Cancel Consultation
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const consultation = await Consultation.findByPk(id);
        if (!consultation) return res.status(404).json({ error: "Consultation not found" });

        const provider = await Provider.findByPk(consultation.provider_id);
        const patient = await Patient.findByPk(consultation.patient_id);

        await consultation.destroy();

        if (provider && patient) {
            // Create a notification for the assigned provider
            await Notification.create({
                provider_id: provider.id,
                type: 'consultation',
                message: `Consultation with ${patient.name} on ${consultation.date} at ${consultation.time} has been deleted/canceled.`
            });

            // Send email notification to the provider
            await sendEmailNotification(
                provider.email,
                `Consultation Canceled`,
                `Hello Dr. ${provider.name},\n\nYour consultation with ${patient.name} on ${consultation.date} at ${consultation.time} has been canceled.\n\nPlease check your schedule for updates.`
            );
        }

        res.status(200).json({ message: "Consultation deleted successfully" });
    } catch (error) {
        console.error(`Error in deleting consultation: ${error.message}`);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


module.exports = router;
