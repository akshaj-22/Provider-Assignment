const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/**
 * Sends an email notification.
 * @param {string} to - Recipient email.
 * @param {string} subject - Email subject.
 * @param {string} message - Email message body.
 */
const sendEmailNotification = async (to, subject, message) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to,
            subject,
            text: message
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to ${to}`);
    } catch (error) {
        console.error(`❌ Error sending email: ${error.message}`);
    }
};

module.exports = { sendEmailNotification };
