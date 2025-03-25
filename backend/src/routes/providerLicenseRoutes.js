const express = require("express");
const router = express.Router();
const { Provider, Notification } = require("../models");
const { sendEmailNotification } = require('../utils/emailService');


router.get("/check-license-expiry", async (req, res) => {
    try {
      const today = new Date().toISOString().split("T")[0]; // Get today's date in YYYY-MM-DD format
      console.log("Today:", today);
  
      // Fetch all providers
      const providers = await Provider.findAll();
  
      // Filter providers whose license has expired
      const expiredProviders = providers.filter(provider => {
        const expiryDate = provider.license_expiry_date.toISOString().split("T")[0]; // Extract date directly
        console.log("Expiry Date:", expiryDate);
        return expiryDate < today;
      });
  
      if (expiredProviders.length === 0) {
        return res.json({ message: "No providers with expired licenses found." });
      }
  
      // Send notifications and emails
      for (const provider of expiredProviders) {
        const formattedDate = provider.license_expiry_date.toISOString().split("T")[0];
  
        // Create a notification for the provider
        await Notification.create({
          provider_id: provider.id,
          type: "license_expiry",
          message: `Your medical license (License No: ${provider.license_number}) expired on ${formattedDate}. Please renew it immediately.`,
        });
  
        // Send an email notification to the provider
        const emailSubject = "Urgent: Your Medical License Has Expired";
        const emailBody = `Hello Dr. ${provider.name},\n\nOur records indicate that your medical license (License No: ${provider.license_number}) expired on ${formattedDate}.\n\nPlease renew your license immediately to continue providing medical services.\n\nBest regards,\nHealthcare Team`;
  
        await sendEmailNotification(provider.email, emailSubject, emailBody);
      }
  
      res.json({
        message: "License expiry check completed.",
        expired_providers: expiredProviders.map(provider => ({
          provider_id: provider.id,
          provider_name: provider.name,
          email: provider.email,
          license_expiry_date: provider.license_expiry_date.toISOString().split("T")[0],
        })),
      });
    } catch (error) {
      console.error("Error checking license expiry:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
  module.exports = router;