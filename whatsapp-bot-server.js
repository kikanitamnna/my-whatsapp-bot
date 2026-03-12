/**
 * AINeuro Agency - Professional AI Business Assistant
 * Handles: 24/7 Support, Interactive Lead Gen, and Booking Confirmations
 */

const axios = require('axios');
const express = require('express');
require('dotenv').config();
const app = express();
app.use(express.json());

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'aineuro_secret_token';

// --- IN-MEMORY STATE MANAGEMENT ---
// Keeps track of which question the user is answering
const userState = {};

// --- SYSTEM PERSONALITY & KNOWLEDGE ---
const AINEURO_SERVICES = `
Our Most Popular Automation Services:
1. AI Chatbot (Website/WA/Insta)
2. Lead Capture & CRM Automation
3. Invoice Generation
4. Email Marketing Automation
5. Appointment Booking
6. Customer Support AI
7. Social Media Auto Posting
8. Data Entry & Reports
9. AI Voice Agent / Call Automation
10. Custom Business Workflows`;

const KNOWLEDGE_BASE = `
AI Neuro Agency helps businesses automate work using AI tools and smart automations. 
We offer a 30-minute FREE consultation on Google Meet where we analyze your business and suggest solutions.`;

/**
 * 1. WEBHOOK VERIFICATION
 */
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token === VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

/**
 * 2. 24/7 INTERACTIVE CONVERSATION LOGIC
 */
app.post('/webhook', async (req, res) => {
    if (req.body.object) {
        if (req.body.entry?.[0]?.changes?.[0]?.value?.messages) {
            const msg = req.body.entry[0].changes[0].value.messages[0];
            const from = msg.from;
            const msgBody = msg.text.body.trim();
            const lowerMsg = msgBody.toLowerCase();

            console.log(`[Message] ${from}: ${msgBody}`);

            // --- CHECK IF USER IS CURRENTLY IN THE BOOKING FLOW ---
            if (userState[from]) {
                return await handleBookingFlow(from, msgBody);
            }

            // --- DEFAULT CONVERSATION & KEYWORDS ---
            let replyText = "";

            const bookingKeywords = ["book meeting", "schedule call", "i want consultation", "book appointment", "appointment"];

            if (bookingKeywords.some(keyword => lowerMsg.includes(keyword))) {
                userState[from] = { step: 1, data: {} };
                replyText = "I'd be happy to help you book a FREE 30-minute consultation on Google Meet! \n\n1. Please enter your *Full Name*:";
                await sendWhatsAppMessage(from, replyText);
            }
            else if (lowerMsg.includes("offer") || lowerMsg.includes("launch")) {
                // This will send your professional template with the button!
                await sendTemplateMessage(from, "launch_offer_neuro");
            }
            else if (lowerMsg.includes("service") || lowerMsg.includes("what you do")) {
                replyText = `${KNOWLEDGE_BASE}\n\n${AINEURO_SERVICES}\n\nWould you like to book a free consultation to discuss any of these?`;
                await sendWhatsAppMessage(from, replyText);
            }
            else if (lowerMsg.includes("hello") || lowerMsg.includes("hi")) {
                replyText = `Hello! I am the AI Assistant for *AI Neuro Agency*. 👋\n\nI help businesses automate their work to save time and increase efficiency.\n\nType *'Services'* to see what we offer or *'Book'* to schedule a free 30-min Google Meet consultation!`;
                await sendWhatsAppMessage(from, replyText);
            }
            else {
                replyText = "Thank you for reaching out! I'm the AINeuro AI Assistant. I can explain our *Services* or help you *Book* a free consultation meeting. What would you like to do?";
                await sendWhatsAppMessage(from, replyText);
            }
        }
        res.sendStatus(200);
    }
});

/**
 * STEP-BY-STEP BOOKING HANDLER
 */
async function handleBookingFlow(from, input) {
    const state = userState[from];
    let reply = "";

    switch (state.step) {
        case 1: // Name received, ask for Phone
            state.data.name = input;
            state.step = 2;
            reply = "Thank you! \n2. Please enter your *Phone Number*:";
            break;
        case 2: // Phone received, ask for Email
            state.data.phone = input;
            state.step = 3;
            reply = "Got it! \n3. Please enter your *Email Address*:";
            break;
        case 3: // Email received, ask for Topic
            state.data.email = input;
            state.step = 4;
            reply = "Final step! \n4. What *Topic* would you like to discuss? (e.g. Chatbots, Workflow, AI Voice)";
            break;
        case 4: // Topic received, finish
            state.data.topic = input;
            console.log(`[LEAD CAPTURED]`, state.data);

            // --- CONSTRUCT SUMMARY MESSAGE ---
            const summary = `*CONFIRMATION: Meeting Request Received* ✅
---------------------------
👤 *Name:* ${state.data.name}
📞 *Phone:* ${state.data.phone}
📧 *Email:* ${state.data.email}
📝 *Topic:* ${state.data.topic}
---------------------------
Our team will review your request and send the *Google Meet* link to you shortly via WhatsApp and Email.

Thank you for choosing AI Neuro Agency! 🚀`;

            // 1. Send detailed summary to the number the client provided
            const targetPhone = state.data.phone.replace(/\D/g, ''); // Clean the number
            if (targetPhone.length >= 10) {
                await sendWhatsAppMessage(targetPhone, summary);
            }

            // 2. Send a final "Thank you" reply to the current chat (if different)
            if (targetPhone !== from) {
                reply = "Thank you! I have sent a full confirmation summary to the phone number you provided. We will be in touch shortly!";
            } else {
                reply = "Form completed! I have just sent your full confirmation summary above. We will be in touch shortly!";
            }

            delete userState[from]; // Clear state after finishing
            break;
    }

    await sendWhatsAppMessage(from, reply);
}

/**
 * 3. EXTERNAL BOOKING CONFIRMATION ENDPOINT
 */
app.post('/incoming-booking', async (req, res) => {
    const { phone, name, date, time } = req.body;

    if (phone) {
        // Clean phone number (remove +, spaces, etc.)
        const cleanPhone = phone.replace(/\D/g, '');
        const message = `Hi ${name || 'there'}! 👋 This is AI Neuro Agency. Your booking for ${date} at ${time} is confirmed. See you on Google Meet!`;

        await sendWhatsAppMessage(cleanPhone, message);
        res.sendStatus(200);
    } else {
        res.status(400).send({ error: 'Phone number missing' });
    }
});

/**
 * Helper: Send WhatsApp Message (Text)
 */
async function sendWhatsAppMessage(to, text) {
    try {
        await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` },
            data: {
                messaging_product: 'whatsapp',
                to: to,
                type: 'text',
                text: { body: text }
            }
        });
    } catch (err) {
        console.error("Error sending text:", err.response?.data || err.message);
    }
}

/**
 * Helper: Send WhatsApp Template Message (Professional Buttons/Layout)
 */
async function sendTemplateMessage(to, templateName) {
    try {
        await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` },
            data: {
                messaging_product: 'whatsapp',
                to: to,
                type: 'template',
                template: {
                    name: templateName,
                    language: { code: 'en_US' }
                }
            }
        });
    } catch (err) {
        console.error("Error sending template:", err.response?.data || err.message);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ AINeuro Pro Bot is Active on port ${PORT}`));

