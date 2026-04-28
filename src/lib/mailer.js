// lib/mailer.js
import nodemailer from 'nodemailer';

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail address
    pass: process.env.EMAIL_APP_PASSWORD, // Gmail App Password (16 characters)
  },
});

// Verify transporter connection
transporter.verify(function (error, success) {
  if (error) {
    console.log('Email transporter error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

/**
 * Send welcome email with credentials
 * @param {string} to - Recipient email
 * @param {string} username - Author username
 * @param {string} password - Generated password
 * @returns {Promise}
 */
export async function sendWelcomeEmail(to, username, password) {
  try {
    const mailOptions = {
      from: {
        name: 'PlabCoach',
        address: process.env.EMAIL_USER,
      },
      to: to,
      subject: 'Welcome to PlabCoach - Your Account Credentials',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: 'Arial', sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 20px auto;
              background: #ffffff;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
            }
            .content {
              padding: 30px;
            }
            .credentials-box {
              background: #f8f9fa;
              border-left: 4px solid #667eea;
              padding: 20px;
              margin: 20px 0;
              border-radius: 5px;
            }
            .credential-item {
              margin: 10px 0;
              font-size: 16px;
            }
            .credential-label {
              font-weight: bold;
              color: #667eea;
            }
            .credential-value {
              background: #ffffff;
              padding: 8px 12px;
              border-radius: 4px;
              display: inline-block;
              margin-top: 5px;
              border: 1px solid #e0e0e0;
              font-family: 'Courier New', monospace;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
            .footer {
              background: #f8f9fa;
              padding: 20px;
              text-align: center;
              font-size: 12px;
              color: #666;
            }
            .warning {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
              border-radius: 5px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to PlabCoach</h1>
            </div>
            
            <div class="content">
              <h2>Hello ${username},</h2>
              <p>Your author account has been successfully created. You can now start managing your books and content on our platform.</p>
              
              <div class="credentials-box">
                <h3 style="margin-top: 0; color: #667eea;">Your Login Credentials</h3>
                
                <div class="credential-item">
                  <div class="credential-label">Username:</div>
                  <div class="credential-value">${username}</div>
                </div>
                
                <div class="credential-item">
                  <div class="credential-label">Email:</div>
                  <div class="credential-value">${to}</div>
                </div>
                
                <div class="credential-item">
                  <div class="credential-label">Password:</div>
                  <div class="credential-value">${password}</div>
                </div>
              </div>
              
              <div class="warning">
                <strong>Important Security Notice:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>Please change your password after first login</li>
                  <li>Do not share your credentials with anyone</li>
                  <li>Keep this email secure or delete it after saving your credentials</li>
                </ul>
              </div>
              
              <center>
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login" class="button">
                  Login to Your Account →
                </a>
              </center>
              
              <p style="margin-top: 30px;">If you have any questions or need assistance, feel free to reach out to our support team.</p>
              
              <p><strong>The Digital Library Team</strong></p>
            </div>
            
            <div class="footer">
              <p>© ${new Date().getFullYear()} Digital Library. All rights reserved.</p>
              <p>This is an automated email, please do not reply to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Welcome to Digital Library!

Hello ${username},

Your author account has been successfully created.

LOGIN CREDENTIALS:
Username: ${username}
Email: ${to}
Password: ${password}

IMPORTANT: Please change your password after first login.

Login at: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login

Best regards,
The Digital Library Team
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(' Error sending email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate random secure password
 * @param {number} length - Password length (default: 12)
 * @returns {string} - Generated password
 */
export function generatePassword(length = 12) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  const allChars = uppercase + lowercase + numbers + symbols;
  
  let password = '';
  
  // Ensure at least one character from each category
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill remaining length with random characters
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

export default transporter;
