/**
 * Luna Massage - Email Service Server
 * Node.js backend for sending booking confirmation emails
 * 
 * Required: Gmail account with App Password
 * Setup: https://support.google.com/accounts/answer/185833
 */

require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*', // In production, specify your actual domains
    credentials: true
}));

app.use(express.json());

// Rate limiting to prevent abuse
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit each IP to 50 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

app.use('/send-confirmation', limiter);

// Email transporter setup
let transporter;

function initializeTransporter() {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD
        }
    });
}

// Verify email configuration on startup
async function verifyEmailConfig() {
    try {
        await transporter.verify();
        console.log('✓ Email server is ready to send messages');
    } catch (error) {
        console.error('✗ Email configuration error:', error.message);
        console.log('Please check your .env file and ensure:');
        console.log('1. EMAIL_USER is set to your Gmail address');
        console.log('2. EMAIL_APP_PASSWORD is set to your Gmail App Password');
        console.log('   Get App Password: https://support.google.com/accounts/answer/185833');
    }
}

// Helper function to format date
function formatDate(dateStr) {
    if (!dateStr) return 'Not specified';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Helper function to format time
function formatTime(timeStr) {
    if (!timeStr) return 'Not specified';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${minutes} ${ampm}`;
}

// Generate booking confirmation email
function generateConfirmationEmail(booking) {
    const emailContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #2C1810;
                    background-color: #FDFBF7;
                    margin: 0;
                    padding: 20px;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background-color: #ffffff;
                    border-radius: 20px;
                    overflow: hidden;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                }
                .header {
                    background: linear-gradient(135deg, #8B5A2B 0%, #A0522D 100%);
                    color: white;
                    padding: 40px 30px;
                    text-align: center;
                }
                .header h1 {
                    margin: 0;
                    font-size: 32px;
                    font-family: Georgia, serif;
                }
                .header p {
                    margin: 10px 0 0 0;
                    opacity: 0.9;
                }
                .content {
                    padding: 40px 30px;
                }
                .success-icon {
                    width: 80px;
                    height: 80px;
                    background: linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 30px;
                }
                .success-icon svg {
                    width: 40px;
                    height: 40px;
                    color: #059669;
                }
                .booking-details {
                    background: linear-gradient(135deg, #F5E6D3 0%, #E8D4C4 100%);
                    border-radius: 15px;
                    padding: 25px;
                    margin: 25px 0;
                }
                .booking-details h3 {
                    margin-top: 0;
                    color: #8B5A2B;
                    font-size: 18px;
                }
                .detail-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 10px 0;
                    border-bottom: 1px solid rgba(139, 90, 43, 0.2);
                }
                .detail-row:last-child {
                    border-bottom: none;
                }
                .detail-label {
                    color: #5C4033;
                    font-weight: 500;
                }
                .detail-value {
                    font-weight: 600;
                    color: #2C1810;
                }
                .payment-info {
                    background: #ECFDF5;
                    border-left: 4px solid #10B981;
                    border-radius: 10px;
                    padding: 20px;
                    margin: 25px 0;
                }
                .payment-info h3 {
                    margin-top: 0;
                    color: #059669;
                }
                .info-box {
                    background: #FEF3C7;
                    border-left: 4px solid #F59E0B;
                    border-radius: 10px;
                    padding: 20px;
                    margin: 25px 0;
                }
                .info-box h3 {
                    margin-top: 0;
                    color: #D97706;
                }
                .footer {
                    background: #2C1810;
                    color: #D4A574;
                    text-align: center;
                    padding: 30px;
                }
                .footer p {
                    margin: 5px 0;
                }
                .btn {
                    display: inline-block;
                    background: linear-gradient(135deg, #8B5A2B 0%, #A0522D 100%);
                    color: white;
                    padding: 15px 30px;
                    text-decoration: none;
                    border-radius: 10px;
                    font-weight: 600;
                    margin-top: 20px;
                }
                @media only screen and (max-width: 600px) {
                    .container {
                        margin: 10px;
                    }
                    .content {
                        padding: 25px 20px;
                    }
                    .detail-row {
                        flex-direction: column;
                        gap: 5px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✨ Luna Massage</h1>
                    <p>Your Relaxation Journey Begins</p>
                </div>
                
                <div class="content">
                    <div class="success-icon">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                        </svg>
                    </div>
                    
                    <h2 style="text-align: center; color: #2C1810; margin-bottom: 10px;">Payment Received! 🎉</h2>
                    <p style="text-align: center; color: #5C4033;">
                        Thank you, ${booking.name}! Your crypto payment has been successfully received and your booking is now <strong>CONFIRMED</strong>.
                    </p>
                    
                    <div class="booking-details">
                        <h3>📋 Booking Details</h3>
                        <div class="detail-row">
                            <span class="detail-label">Booking ID:</span>
                            <span class="detail-value">${booking.bookingId}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Service:</span>
                            <span class="detail-value">${booking.service}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Date:</span>
                            <span class="detail-value">${formatDate(booking.date)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Time:</span>
                            <span class="detail-value">${formatTime(booking.time)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Amount Paid:</span>
                            <span class="detail-value">$${booking.servicePrice} (${booking.cryptoAmount} ${booking.crypto})</span>
                        </div>
                    </div>
                    
                    <div class="payment-info">
                        <h3>💳 Payment Confirmed</h3>
                        <p>We have received your payment of <strong>${booking.cryptoAmount} ${booking.crypto}</strong> in our wallet. Your transaction has been verified and recorded.</p>
                    </div>
                    
                    ${booking.specialRequests ? `
                    <div class="info-box">
                        <h3>📝 Special Requests</h3>
                        <p>${booking.specialRequests}</p>
                    </div>
                    ` : ''}
                    
                    <div class="info-box" style="background: #DBEAFE; border-left-color: #3B82F6;">
                        <h3 style="color: #1E40AF;">📍 What to Expect</h3>
                        <ul style="margin: 10px 0; padding-left: 20px;">
                            <li>Please arrive 10 minutes early for your appointment</li>
                            <li>Wear comfortable clothing</li>
                            <li>Inform your therapist of any health concerns</li>
                            <li>Free parking available on-site</li>
                        </ul>
                    </div>
                    
                    <p style="text-align: center; margin-top: 30px; color: #5C4033;">
                        Need to reschedule? Contact us at least 24 hours before your appointment.
                    </p>
                    
                    <div style="text-align: center;">
                        <a href="mailto:info@lunamassage.com" class="btn">Contact Us</a>
                    </div>
                </div>
                
                <div class="footer">
                    <p><strong>Luna Massage</strong></p>
                    <p>123 Wellness Street, New York, NY 10001</p>
                    <p>📞 (555) 123-4567 | ✉️ info@lunamassage.com</p>
                    <p style="margin-top: 15px; font-size: 12px; opacity: 0.7;">
                        © ${new Date().getFullYear()} Luna Massage. All rights reserved.
                    </p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    return emailContent;
}

// Generate booking reminder email
function generateReminderEmail(booking) {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #2C1810; background: #FDFBF7; margin: 0; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #8B5A2B 0%, #A0522D 100%); color: white; padding: 40px 30px; text-align: center; }
                .content { padding: 40px 30px; }
                .booking-details { background: linear-gradient(135deg, #F5E6D3 0%, #E8D4C4 100%); border-radius: 15px; padding: 25px; margin: 25px 0; }
                .footer { background: #2C1810; color: #D4A574; text-align: center; padding: 30px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✨ Luna Massage</h1>
                    <p>Booking Reminder</p>
                </div>
                <div class="content">
                    <h2>Appointment Confirmed ✅</h2>
                    <p>Hello ${booking.name},</p>
                    <p>This is a reminder of your upcoming appointment at Luna Massage.</p>
                    <div class="booking-details">
                        <p><strong>Booking ID:</strong> ${booking.bookingId}</p>
                        <p><strong>Service:</strong> ${booking.service}</p>
                        <p><strong>Date:</strong> ${formatDate(booking.date)}</p>
                        <p><strong>Time:</strong> ${formatTime(booking.time)}</p>
                    </div>
                    <p>We look forward to seeing you!</p>
                </div>
                <div class="footer">
                    <p>📞 (555) 123-4567 | ✉️ info@lunamassage.com</p>
                </div>
            </div>
        </body>
        </html>
    `;
}

// API endpoint to send confirmation email
app.post('/send-confirmation', async (req, res) => {
    console.log('📧 Received email request:', new Date().toISOString());
    
    try {
        const { booking, status } = req.body;
        
        // Validate request
        if (!booking || !booking.email) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required booking data' 
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(booking.email)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid email address' 
            });
        }
        
        // Select email template based on status
        const isConfirmation = status === 'confirmed';
        const subject = isConfirmation 
            ? `✨ Payment Confirmed - Luna Massage Booking ${booking.bookingId}`
            : `📅 Reminder - Your Luna Massage Appointment`;
        const htmlContent = isConfirmation 
            ? generateConfirmationEmail(booking)
            : generateReminderEmail(booking);
        
        // Email options
        const mailOptions = {
            from: `"Luna Massage" <${process.env.EMAIL_USER}>`,
            to: booking.email,
            subject: subject,
            html: htmlContent,
            replyTo: 'info@lunamassage.com'
        };
        
        console.log(`📤 Sending email to: ${booking.email}`);
        
        // Send email
        const info = await transporter.sendMail(mailOptions);
        
        console.log('✓ Email sent successfully:', info.messageId);
        console.log('  Preview:', nodemailer.getTestMessageUrl(info));
        
        res.json({ 
            success: true, 
            messageId: info.messageId,
            recipient: booking.email,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('✗ Error sending email:', error);
        
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'Luna Massage Email Service',
        timestamp: new Date().toISOString()
    });
});

// Test endpoint (for development)
app.get('/test', async (req, res) => {
    try {
        const testBooking = {
            bookingId: 'LM' + Date.now(),
            name: 'Test Client',
            email: process.env.TEST_EMAIL || process.env.EMAIL_USER,
            service: 'Swedish Massage',
            date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            time: '14:00',
            servicePrice: 80,
            crypto: 'BTC',
            cryptoAmount: '0.0015',
            specialRequests: 'Test booking - please ignore'
        };
        
        const mailOptions = {
            from: `"Luna Massage" <${process.env.EMAIL_USER}>`,
            to: testBooking.email,
            subject: `🧪 Test Email - Luna Massage`,
            html: generateConfirmationEmail(testBooking)
        };
        
        await transporter.sendMail(mailOptions);
        
        res.json({ 
            success: true, 
            message: 'Test email sent successfully',
            to: testBooking.email
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
function startServer() {
    initializeTransporter();
    
    app.listen(PORT, () => {
        console.log('\n╔══════════════════════════════════════════════╗');
        console.log('║   🌙 Luna Massage Email Service Server     ║');
        console.log('╚══════════════════════════════════════════════╝\n');
        console.log(`✓ Server running on port ${PORT}`);
        console.log(`✓ Health check: http://localhost:${PORT}/health`);
        console.log(`✓ Test email: http://localhost:${PORT}/test`);
        console.log(`✓ Email endpoint: http://localhost:${PORT}/send-confirmation\n`);
    });
    
    // Verify email configuration after server starts
    setTimeout(verifyEmailConfig, 1000);
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n📴 SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n📴 SIGINT received, shutting down gracefully...');
    process.exit(0);
});

// Start the server
startServer();

module.exports = app;
