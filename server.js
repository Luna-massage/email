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

// ================ FIX 1: CORRECT CORS ================
app.use(cors({
    origin: [
        'https://lunamassage.netlify.app',  // ⬅️ REMOVED /admin
        'http://localhost:5500',
        'https://your-render-app.onrender.com'  // Add your Render URL here
    ],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS']
}));

app.use(express.json());

// Rate limiting to prevent abuse
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit each IP to 50 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again later.' }
});

app.use('/send-confirmation', limiter);

// ================ FIX 2: INITIALIZE TRANSPORTER IMMEDIATELY ================
let transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    },
    requireTLS: true  // Important for Gmail
});

// Verify email configuration on startup
async function verifyEmailConfig() {
    try {
        await transporter.verify();
        console.log('✓ Email server is ready to send messages');
    } catch (error) {
        console.error('✗ Email configuration error:', error.message);
        console.log('Please check your environment variables on Render:');
        console.log('1. EMAIL_USER should be your Gmail address');
        console.log('2. EMAIL_APP_PASSWORD should be your Gmail App Password');
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

// Generate booking confirmation email (keep your existing HTML)
function generateConfirmationEmail(booking) {
    // Your existing HTML template here (keep it as is)
    return `...`; // Your HTML template
}

// Generate booking reminder email (keep your existing HTML)
function generateReminderEmail(booking) {
    // Your existing HTML template here (keep it as is)
    return `...`; // Your HTML template
}

// ================ FIX 3: ADD ROOT ENDPOINT ================
app.get('/', (req, res) => {
    res.json({
        service: 'Luna Massage Email Service',
        status: 'running',
        endpoints: {
            health: 'GET /health',
            sendEmail: 'POST /send-confirmation',
            test: 'GET /test (development only)'
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
            replyTo: 'info@lunamassage.com',
            text: `Luna Massage Booking Confirmation\n\nBooking ID: ${booking.bookingId}\nService: ${booking.service}\nDate: ${formatDate(booking.date)}\nTime: ${formatTime(booking.time)}\n\nThank you for your booking!`
        };
        
        console.log(`📤 Sending email to: ${booking.email}`);
        
        // Send email
        const info = await transporter.sendMail(mailOptions);
        
        console.log('✓ Email sent successfully:', info.messageId);
        
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
        const testBooking = {
            bookingId: 'LM' + Date.now(),
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
    res.status(404).json({ 
        error: 'Endpoint not found',
        availableEndpoints: ['/', '/health', '/send-confirmation', '/test'],
        method: req.method,
        path: req.path
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
function startServer() {
    // Initialize transporter is now done at the top
    
    app.listen(PORT, () => {
        console.log('\n╔══════════════════════════════════════════════╗');
        console.log('║   🌙 Luna Massage Email Service Server     ║');
        console.log('╚══════════════════════════════════════════════╝\n');
        console.log(`✓ Server running on port ${PORT}`);
        console.log(`✓ Health check: http://localhost:${PORT}/health`);
        console.log(`✓ Root endpoint: http://localhost:${PORT}/`);
        console.log(`✓ Email endpoint: http://localhost:${PORT}/send-confirmation\n`);
        
        // Log environment check
        console.log('📋 Environment check:');
        console.log(`   EMAIL_USER: ${process.env.EMAIL_USER ? 'Set ✓' : 'Missing ✗'}`);
        console.log(`   EMAIL_APP_PASSWORD: ${process.env.EMAIL_APP_PASSWORD ? 'Set ✓' : 'Missing ✗'}`);
        console.log('');
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
if (require.main === module) {
    startServer();
}

module.exports = app;
