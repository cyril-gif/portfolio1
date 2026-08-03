import { Router } from 'express';
import Message from '../models/Message.js';
import { sendContactNotification } from '../utils/mailer.js';

const router = Router();

// POST /api/contact — receive a message from the portfolio contact form
router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required.'
      });
    }

    const newMessage = await Message.create({ name, email, subject, message });

    // Fire-and-forget — don't make the person wait on email delivery,
    // and never let a mail failure break the form submission.
    sendContactNotification({ name, email, subject, message });

    return res.status(201).json({
      success: true,
      message: "Thanks — your message has been sent. I'll get back to you soon.",
      data: {
        id: newMessage._id,
        createdAt: newMessage.createdAt
      }
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const firstError = Object.values(error.errors)[0].message;
      return res.status(400).json({ success: false, error: firstError });
    }

    console.error('Contact form error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Something went wrong on our end. Please try again shortly.'
    });
  }
});

// GET /api/contact — list messages (basic admin/debug use)
router.get('/', async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 });
    return res.json({ success: true, count: messages.length, data: messages });
  } catch (error) {
    console.error('Fetch messages error:', error.message);
    return res.status(500).json({ success: false, error: 'Could not retrieve messages.' });
  }
});

export default router;
