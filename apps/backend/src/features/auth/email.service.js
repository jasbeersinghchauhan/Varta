import "../../config/env.js";
import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

export async function sendVerificationEmail(
    to,
    username,
    verificationUrl
) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error("Email configuration missing");
    }

    if (!to || !verificationUrl) {
        throw new Error("Invalid email parameters");
    }

    try {
        const info = await transporter.sendMail({
            from: `"Varta" <${process.env.EMAIL_USER}>`,
            to,
            subject: "Verify your Varta Account",
            text: `Hello ${username}, verify your email: ${verificationUrl}`,
            html: `
                <div style="background:#f9f9f9; padding:20px 0; font-family:Arial, Helvetica, sans-serif; color:#333;">
                    <table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background:#ffffff;">
                        <tr>
                        <td style="padding:30px; text-align:center;">
                            
                            <h2 style="margin:0 0 15px; color:#1a1a1a;">
                            Verify your email
                            </h2>

                            <p style="font-size:15px; line-height:1.5; margin:0 0 20px;">
                            Hello <strong>${username}</strong>,<br>
                            Please confirm your email address to get started.
                            </p>

                            <a href="${verificationUrl}"
                            style="display:inline-block; padding:12px 24px; background:#007bff; color:#ffffff; text-decoration:none; font-weight:bold; border-radius:4px;">
                            Verify Email
                            </a>

                                <hr>

                            <p style="font-size:12px; color:#888; margin:0;">
                            This is an automated message. Please do not reply.
                            </p>

                        </td>
                        </tr>
                    </table>
                </div>
            `
        });

        return info;
    } catch (err) {
        console.error("Error sending email: ", err);
        err.message = `Email delivery failed: ${err.message}`;
        throw err;
    }
}

export async function sendPasswordResetEmail(to, resetUrl) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error("Email configuration missing");
    }
    
    if (!to || !resetUrl) {
        throw new Error("Invalid email parameters");
    }

    try {
        const info = await transporter.sendMail({
            from: `"Varta" <${process.env.EMAIL_USER}>`,
            to,
            subject: "Reset your Varta Password",
            text: `Click the following link to reset your password: ${resetUrl}`,
            html: `
                <div style="background:#f9f9f9; padding:20px 0; font-family:Arial, Helvetica, sans-serif; color:#333;">
                    <table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background:#ffffff;">
                        <tr>
                        <td style="padding:30px; text-align:center;">
                            <h2 style="margin:0 0 15px; color:#1a1a1a;">Password Reset Request</h2>
                            <p style="font-size:15px; line-height:1.5; margin:0 0 20px;">
                                We received a request to reset your password. Click the button below to choose a new one.
                            </p>
                            <a href="${resetUrl}" style="display:inline-block; padding:12px 24px; background:#007bff; color:#ffffff; text-decoration:none; font-weight:bold; border-radius:4px;">
                                Reset Password
                            </a>
                        </td>
                        </tr>
                    </table>
                </div>
            `
        });

        return info;
    } catch (err) {
        console.error("Error sending reset email: ", err);
        throw err;
    }
}