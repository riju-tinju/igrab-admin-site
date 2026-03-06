var express = require('express');
var router = express.Router();
const contactHelper = require('../helper/contactHelper');
const asyncHandler = require('../helper/asyncHandler');

// Get all contacts with pagination and filtering
router.get('/contacts', asyncHandler(async function (req, res, next) {
    res.render('pages/contacts/contacts', { title: 'Contact Messages' });
}));

// Debug endpoint to check admin session
router.get('/api/contacts/debug/session', asyncHandler(async function (req, res, next) {
    const Contact = require('../model/contactSchema');

    const adminSession = req.session?.admin;
    const totalContacts = await Contact.countDocuments({});
    const contactsWithBranch = await Contact.countDocuments({ storeBranch: adminSession?.selectedBranch });

    res.json({
        adminSession: adminSession,
        totalContactsInDB: totalContacts,
        contactsMatchingAdminBranch: contactsWithBranch,
        sampleContacts: await Contact.find({}).limit(2).lean()
    });
}));

// API endpoint to fetch contacts
router.get('/api/contacts', asyncHandler(async function (req, res, next) {
    const result = await contactHelper.getContacts(req, res);
    res.json(result);
}));

// Get single contact details
router.get('/api/contacts/:id', asyncHandler(async function (req, res, next) {
    const result = await contactHelper.getContactById(req, res);
    res.json(result);
}));

// Update contact status
router.patch('/api/contacts/:id/status', asyncHandler(async function (req, res, next) {
    const result = await contactHelper.updateContactStatus(req, res);
    res.json(result);
}));

// Delete contact
router.delete('/api/contacts/:id', asyncHandler(async function (req, res, next) {
    const result = await contactHelper.deleteContact(req, res);
    res.json(result);
}));

module.exports = router;
