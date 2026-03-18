const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports.sendOTP = async (to, otp) => {
  await resend.emails.send({
    from: process.env.RESEND_FROM,
    to,
    subject: 'Your NetworkMatch login code',
    text: `Your login code is: ${otp}\n\nExpires in 10 minutes.`,
  });
};
