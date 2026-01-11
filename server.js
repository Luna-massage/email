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

// ================ CRITICAL FIX 1: FIX CORS ================
// REMOVE /admin from the URL - CORS origin should be just the domain
app.use(cors({
    origin: [
        'https://lunamassage.netlify.app',  // ⬅️ REMOVED /admin
        'http://localhost:5500',
        'http://localhost:3000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS']
}));

app.use(express.json());

// Rate limiting to prevent abuse
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit each IP to 50 requests per windowMs
    message: { 
        success: false, 
        error: 'Too many requests from this IP, please try again later.' 
    }
});

app.use('/send-confirmation', limiter);

// ================ CRITICAL FIX 2: ADD TIMEOUT TO TRANSPORTER ================
let transporter;

function initializeTransporter() {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,  // IMPORTANT: Add this line
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD
        },
        // ⬇️ ADD THESE TIMEOUT SETTINGS TO PREVENT "CONNECTION TIMEOUT" ⬇️
        connectionTimeout: 30000,    // 30 seconds
        greetingTimeout: 30000,      // 30 seconds  
        socketTimeout: 60000,        // 60 seconds
        // ⬆️ THESE PREVENT TIMEOUT ERRORS ⬆️
        tls: {
            rejectUnauthorized: false  // Allow self-signed certificates
        }
    });
}

// Verify email configuration on startup
async function verifyEmailConfig() {
    try {
        await transporter.verify();
        console.log('✅ Email server is ready to send messages');
        console.log('📧 Email user:', process.env.EMAIL_USER ? 'Configured' : 'Missing');
    } catch (error) {
        console.error('❌ Email configuration error:', error.message);
        console.log('📋 Please check your environment variables on Render:');
        console.log('1. EMAIL_USER should be your Gmail address');
        console.log('2. EMAIL_APP_PASSWORD should be your 16-character Gmail App Password');
        console.log('   Get App Password: https://support.google.com/accounts/answer/185833');
    }
}

// Helper function to format date
function formatDate(dateStr) {
    if (!dateStr) return 'Not specified';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        return dateStr;
    }
}

// Helper function to format time
function formatTime(timeStr) {
    if (!timeStr) return 'Not specified';
    try {
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours);
        if (isNaN(hour)) return timeStr;
        
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const formattedHour = hour % 12 || 12;
        return `${formattedHour}:${minutes || '00'} ${ampm}`;
    } catch (error) {
        return timeStr;
    }
}

// ================ CRITICAL FIX 3: ADD RETRY LOGIC ================
async function sendEmailWithRetry(mailOptions, maxRetries = 2) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`📤 Attempt ${attempt}/${maxRetries} to send email`);
            const info = await transporter.sendMail(mailOptions);
            return info;
        } catch (error) {
            lastError = error;
            console.log(`⚠️ Attempt ${attempt} failed:`, error.message);
            
            if (attempt < maxRetries) {
                // Wait before retrying (exponential backoff)
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`⏳ Waiting ${delay/1000}s before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
}

// Generate booking confirmation email (keep your existing HTML)
function generateConfirmationEmail(booking) {
    // Your existing HTML template - keep it as is
    return `...`; // Your HTML content here
}

// Generate booking reminder email (keep your existing HTML)  
function generateReminderEmail(booking) {
    // Your existing HTML template - keep it as is
    return `...`; // Your HTML content here
}

// ================ CRITICAL FIX 4: ADD ROOT ENDPOINT ================
app.get('/', (req, res) => {
    res.json({
        service: 'Luna Massage Email Service',
        status: 'running',
        endpoints: {
            health: 'GET /health',
            sendEmail: 'POST /send-confirmation',
            test: 'GET /test'
        },
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'Luna Massage Email Service',
        emailConfigured: !!process.env.EMAIL_USER,
        timestamp: new Date().toISOString()
    });
});

// ================ CRITICAL FIX 5: UPDATE /send-confirmation ENDPOINT ================
app.post('/send-confirmation', async (req, res) => {
    console.log('📧 Received email request:', new Date().toISOString());
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    // Set timeout for this request
    req.setTimeout(45000); // 45 seconds timeout for the entire request
    
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
        
        // Check if transporter is initialized
        if (!transporter) {
            initializeTransporter();
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
            replyTo: 'info@lunamassage.com',
            // Add text version as fallback
            text: `Luna Massage Booking Confirmation\n\n` +
                  `Booking ID: ${booking.bookingId || 'N/A'}\n` +
                  `Service: ${booking.service || 'N/A'}\n` +
                  `Date: ${formatDate(booking.date)}\n` +
                  `Time: ${formatTime(booking.time)}\n` +
                  `Amount: $${booking.servicePrice || '0'}\n\n` +
                  `Thank you for your booking!`
        };
        
        console.log(`📤 Sending email to: ${booking.email}`);
        console.log(`📝 Subject: ${subject}`);
        
        // Send email with retry logic
        const info = await sendEmailWithRetry(mailOptions, 2);
        
        console.log('✅ Email sent successfully!');
        console.log(`   Message ID: ${info.messageId}`);
        console.log(`   Response: ${info.response}`);
        
        res.json({ 
            success: true, 
            messageId: info.messageId,
            recipient: booking.email,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error sending email:', error);
        
        // Provide specific error messages
        let errorMessage = error.message;
        let statusCode = 500;
        
        if (error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
            errorMessage = 'Connection to Gmail timed out. Please try again.';
            statusCode = 504;
        } else if (error.code === 'EAUTH') {
            errorMessage = 'Email authentication failed. Check your Gmail App Password on Render.';
        } else if (error.code === 'ECONNECTION') {
            errorMessage = 'Cannot connect to Gmail servers. Check network or firewall settings.';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = 'Cannot resolve Gmail server. Network issue.';
        }
        
        res.status(statusCode).json({ 
            success: false, 
            error: errorMessage,
            code: error.code,
            timestamp: new Date().toISOString()
        });
    }
});

// Test endpoint (for development)
app.get('/test', async (req, res) => {
    try {
        // Check if email is configured
        if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
            return res.status(500).json({ 
                success: false, 
                error: 'Email not configured. Set EMAIL_USER and EMAIL_APP_PASSWORD on Render.' 
            });
        }
        
        const testEmail = process.env.TEST_EMAIL || process.env.EMAIL_USER;
        if (!testEmail) {
            return res.status(400).json({
                success: false,
                error: 'No test email available. Set TEST_EMAIL or EMAIL_USER.'
            });
        }
        
        const testBooking = {
            bookingId: 'TEST-' + Date.now(),
            name: 'Test Client',
            email: testEmail,
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
            html: generateConfirmationEmail(testBooking),
            text: 'Test email from Luna Massage Email Service'
        };
        
        const info = await sendEmailWithRetry(mailOptions, 1);
        
        res.json({ 
            success: true, 
            message: 'Test email sent successfully',
            to: testBooking.email,
            messageId: info.messageId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Test email error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Endpoint not found',
        availableEndpoints: ['GET /', 'GET /health', 'POST /send-confirmation', 'GET /test'],
        path: req.path,
        method: req.method
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('🔥 Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
function startServer() {
    // Initialize transporter
    initializeTransporter();
    
    app.listen(PORT, () => {
        console.log('\n' + '═'.repeat(60));
        console.log('   🌙 Luna Massage Email Service Server');
        console.log('═'.repeat(60) + '\n');
        console.log(`✅ Server running on port ${PORT}`);
        console.log(`✅ Health check: http://localhost:${PORT}/health`);
        console.log(`✅ Root endpoint: http://localhost:${PORT}/`);
        console.log(`✅ Email endpoint: http://localhost:${PORT}/send-confirmation\n`);
        console.log('📋 Environment check:');
        console.log(`   PORT: ${PORT}`);
        console.log(`   EMAIL_USER: ${process.env.EMAIL_USER ? 'Set ✓' : 'Missing ✗'}`);
        console.log(`   EMAIL_APP_PASSWORD: ${process.env.EMAIL_APP_PASSWORD ? 'Set ✓' : 'Missing ✗'}`);
        console.log('\n' + '─'.repeat(60));
    });
    
    // Verify email configuration after server starts
    setTimeout(verifyEmailConfig, 2000);
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
if (require.main === module) {
    startServer();
}

module.exports = app;
