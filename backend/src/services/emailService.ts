import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendOtpEmail = async (email: string, otp: string) => {
  const { data, error } = await resend.emails.send({
    from: "SyncVela Security <noreply@syncvela.codes>",
    to: email,
    subject: "Your SyncVela Verification Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #111827; text-align: center;">Verify Your Account</h2>
        <p style="color: #4b5563; font-size: 16px; text-align: center;">Enter the following 6-digit code to securely access your workspace.</p>
        <div style="margin: 30px 0; text-align: center;">
          <span style="background-color: #f3f4f6; color: #111827; padding: 12px 24px; border-radius: 6px; font-size: 28px; font-weight: bold; letter-spacing: 6px;">${otp}</span>
        </div>
        <p style="color: #9ca3af; font-size: 14px; text-align: center;">This code expires in 15 minutes.</p>
      </div>
    `,
  });

  if (error) {
    console.error("❌ Resend Email Error:", error);
    throw new Error("Failed to send OTP email.");
  }
  return data;
};

export const sendPasswordResetOtpEmail = async (email: string, otp: string) => {
  const { data, error } = await resend.emails.send({
    from: "SyncVela Security <noreply@syncvela.codes>",
    to: email,
    subject: "Reset Your SyncVela Password",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #111827; text-align: center;">Password Reset Request</h2>
        <p style="color: #4b5563; font-size: 16px; text-align: center;">Enter this 6-digit code to reset your password. If you didn't request this, ignore this email.</p>
        <div style="margin: 30px 0; text-align: center;">
          <span style="background-color: #fee2e2; color: #991b1b; padding: 12px 24px; border-radius: 6px; font-size: 28px; font-weight: bold; letter-spacing: 6px;">${otp}</span>
        </div>
        <p style="color: #9ca3af; font-size: 14px; text-align: center;">This code expires in 15 minutes.</p>
      </div>
    `,
  });

  if (error) console.error("❌ Resend Email Error:", error);
  return data;
};
