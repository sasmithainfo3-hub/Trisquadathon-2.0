import express from 'express';
import { z } from 'zod';
import { TrustedContact } from '../models/TrustedContact.js';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendEmail, generateContactInvitationEmail } from '../services/emailService.js';
import { recordAuditLog } from '../services/auditService.js';
import { emitToUser } from '../config/socket.js';
import { config } from '../config/env.js';

const router = express.Router();

const createContactSchema = z.object({
  name: z.string().min(2, 'Name is required').max(100),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional().default(''),
  relationship: z.string().optional().default('Friend'),
  priorityOrder: z.number().int().min(1).optional(),
  notes: z.string().max(500).optional().default(''),
  autoVerify: z.boolean().optional().default(false)
});

const updateContactSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  relationship: z.string().optional(),
  priorityOrder: z.number().int().min(1).optional(),
  canReceiveAlerts: z.boolean().optional(),
  notes: z.string().max(500).optional()
});

const reorderSchema = z.object({
  orders: z.array(z.object({
    id: z.string(),
    priorityOrder: z.number().int().min(1)
  }))
});

// GET /api/v1/contacts
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const contacts = await TrustedContact.find({ userId: req.user._id }).sort({ priorityOrder: 1, createdAt: 1 });
    const formatted = contacts.map((c) => {
      const obj = c.toObject();
      const verificationUrl = `${config.clientUrl}/verify-contact/${c.verificationToken}`;
      obj.verificationUrl = verificationUrl;

      const cleanPhone = (c.phone || '').replace(/[^0-9+]/g, '');
      const inviteText = `Hello ${c.name}, ${req.user.name} added you as their Priority #${c.priorityOrder} Trusted Safety Contact on SafePath. Please confirm your availability by tapping this link: ${verificationUrl}`;

      if (cleanPhone) {
        obj.whatsappUrl = `https://api.whatsapp.com/send?phone=${encodeURIComponent(cleanPhone)}&text=${encodeURIComponent(inviteText)}`;
        obj.smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(inviteText)}`;
      }
      obj.mailtoUrl = `mailto:${c.email}?subject=${encodeURIComponent(`SafePath: ${req.user.name} added you as a Trusted Safety Contact`)}&body=${encodeURIComponent(inviteText)}`;
      return obj;
    });

    res.json({
      success: true,
      contacts: formatted
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/contacts
router.post('/', requireAuth, validate(createContactSchema), async (req, res, next) => {
  try {
    const { name, email, phone, relationship, notes } = req.body;

    // Determine default priority order (next highest)
    let priorityOrder = req.body.priorityOrder;
    if (!priorityOrder) {
      const highestContact = await TrustedContact.findOne({ userId: req.user._id }).sort({ priorityOrder: -1 });
      priorityOrder = highestContact ? highestContact.priorityOrder + 1 : 1;
    }

    const isAutoVerify = Boolean(req.body.autoVerify);
    const contact = await TrustedContact.create({
      userId: req.user._id,
      name,
      email: email.toLowerCase(),
      phone,
      relationship,
      priorityOrder,
      notes,
      status: isAutoVerify ? 'verified' : 'pending',
      verifiedAt: isAutoVerify ? new Date() : undefined
    });

    // Send invitation email
    const emailPayload = generateContactInvitationEmail(contact, req.user);
    await sendEmail(emailPayload);

    await recordAuditLog({
      userId: req.user._id,
      action: 'ADD_TRUSTED_CONTACT',
      resourceType: 'TrustedContact',
      resourceId: contact._id,
      req,
      details: { email: contact.email, priorityOrder }
    });

    const contactObj = contact.toObject();
    const verificationUrl = `${config.clientUrl}/verify-contact/${contact.verificationToken}`;
    contactObj.verificationUrl = verificationUrl;

    const cleanPhone = (contact.phone || '').replace(/[^0-9+]/g, '');
    const inviteText = `Hello ${contact.name}, ${req.user.name} added you as their Priority #${contact.priorityOrder} Trusted Safety Contact on SafePath. Please confirm your availability by tapping this link: ${verificationUrl}`;

    if (cleanPhone) {
      contactObj.whatsappUrl = `https://api.whatsapp.com/send?phone=${encodeURIComponent(cleanPhone)}&text=${encodeURIComponent(inviteText)}`;
      contactObj.smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(inviteText)}`;
    }
    contactObj.mailtoUrl = `mailto:${contact.email}?subject=${encodeURIComponent(`SafePath: ${req.user.name} added you as a Trusted Safety Contact`)}&body=${encodeURIComponent(inviteText)}`;

    res.status(201).json({
      success: true,
      message: `Invitation generated for ${contact.name}!`,
      contact: contactObj
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/contacts/reorder
router.put('/reorder', requireAuth, validate(reorderSchema), async (req, res, next) => {
  try {
    const { orders } = req.body;
    for (const item of orders) {
      await TrustedContact.updateOne(
        { _id: item.id, userId: req.user._id },
        { $set: { priorityOrder: item.priorityOrder } }
      );
    }

    const updatedContacts = await TrustedContact.find({ userId: req.user._id }).sort({ priorityOrder: 1 });
    res.json({
      success: true,
      message: 'Contact priority order updated successfully',
      contacts: updatedContacts
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/contacts/:id
router.put('/:id', requireAuth, validate(updateContactSchema), async (req, res, next) => {
  try {
    const contact = await TrustedContact.findOne({ _id: req.params.id, userId: req.user._id });
    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    Object.assign(contact, req.body);
    await contact.save();

    res.json({
      success: true,
      message: 'Contact updated successfully',
      contact
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/contacts/:id
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const contact = await TrustedContact.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    await recordAuditLog({
      userId: req.user._id,
      action: 'DELETE_TRUSTED_CONTACT',
      resourceType: 'TrustedContact',
      resourceId: req.params.id,
      req
    });

    res.json({
      success: true,
      message: 'Contact removed successfully'
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/contacts/:id/instant-verify (Authenticated owner can instantly verify for testing)
router.post('/:id/instant-verify', requireAuth, async (req, res, next) => {
  try {
    const contact = await TrustedContact.findOne({ _id: req.params.id, userId: req.user._id });
    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    contact.status = 'verified';
    contact.verifiedAt = new Date();
    await contact.save();

    await Notification.create({
      userId: req.user._id,
      type: 'CONTACT_VERIFIED',
      title: 'Trusted Contact Verified',
      body: `${contact.name} (${contact.relationship}) has been marked as verified and can now receive safety alerts.`,
      data: { contactId: contact._id }
    });

    emitToUser(req.user._id, 'contact:verified', {
      contactId: contact._id,
      contactName: contact.name
    });

    res.json({
      success: true,
      message: `${contact.name} is now verified as your Priority #${contact.priorityOrder} trusted contact!`,
      contact
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/contacts/:id/resend-invite
router.post('/:id/resend-invite', requireAuth, async (req, res, next) => {
  try {
    const contact = await TrustedContact.findOne({ _id: req.params.id, userId: req.user._id });
    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    const emailPayload = generateContactInvitationEmail(contact, req.user);
    await sendEmail(emailPayload);

    const verificationUrl = `${config.clientUrl}/verify-contact/${contact.verificationToken}`;

    res.json({
      success: true,
      message: `Invitation resent to ${contact.email}! Verification link: ${verificationUrl}`,
      verificationUrl
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/contacts/verify/:token (Public)
router.get('/verify/:token', async (req, res, next) => {
  try {
    const contact = await TrustedContact.findOne({ verificationToken: req.params.token }).populate('userId', 'name email');
    if (!contact) {
      return res.status(404).json({ success: false, message: 'Invalid or expired invitation token.' });
    }

    res.json({
      success: true,
      contact: {
        id: contact._id,
        name: contact.name,
        email: contact.email,
        relationship: contact.relationship,
        status: contact.status,
        inviterName: contact.userId?.name || 'A SafePath User'
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/contacts/verify/:token (Public)
router.post('/verify/:token', async (req, res, next) => {
  try {
    const { action } = req.body; // 'accept' or 'decline'
    const contact = await TrustedContact.findOne({ verificationToken: req.params.token }).populate('userId');
    if (!contact) {
      return res.status(404).json({ success: false, message: 'Invalid or expired invitation token.' });
    }

    if (action === 'decline') {
      contact.status = 'declined';
      await contact.save();
      return res.json({ success: true, message: 'You have declined this safety contact invitation.' });
    }

    contact.status = 'verified';
    contact.verifiedAt = new Date();
    await contact.save();

    if (contact.userId) {
      await Notification.create({
        userId: contact.userId._id,
        type: 'CONTACT_VERIFIED',
        title: 'Trusted Contact Verified',
        body: `${contact.name} has confirmed their availability as your Priority #${contact.priorityOrder} trusted contact.`,
        data: { contactId: contact._id }
      });

      emitToUser(contact.userId._id, 'contact:verified', {
        contactId: contact._id,
        contactName: contact.name
      });
    }

    res.json({
      success: true,
      message: `Thank you, ${contact.name}! You are now verified as a trusted contact for ${contact.userId?.name || 'your friend'}.`
    });
  } catch (err) {
    next(err);
  }
});

export default router;
