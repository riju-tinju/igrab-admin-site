const Contact = require('../model/contactSchema');

module.exports = {
    // Get all contacts with pagination and filtering
    getContacts: (req, res) => {
        return new Promise(async (resolve, reject) => {
            try {
                const {
                    page = 1,
                    limit = 20,
                    status = 'all',
                    search = '',
                    sortBy = 'submittedAt',
                    sortOrder = 'desc'
                } = req.query;

                const query = {};

                // Filter by admin's selected branch
                const adminBranch = req.session?.admin?.selectedBranch;
                console.log('Admin selected branch:', adminBranch);

                if (adminBranch) {
                    query.storeBranch = adminBranch;
                    console.log('Filtering contacts by branch:', adminBranch);
                } else {
                    console.log('No admin branch filter - showing all contacts');
                }

                // Filter by status
                if (status && status !== 'all') {
                    query.status = status;
                }

                // Search by name or email
                if (search) {
                    query.$or = [
                        { name: { $regex: search, $options: 'i' } },
                        { email: { $regex: search, $options: 'i' } },
                        { message: { $regex: search, $options: 'i' } }
                    ];
                }

                const skip = (parseInt(page) - 1) * parseInt(limit);
                const sort = {};
                sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

                console.log('Contact query:', JSON.stringify(query));
                console.log('Fetching contacts with pagination:', { page, limit, skip });

                const [contacts, total] = await Promise.all([
                    Contact.find(query)
                        .sort(sort)
                        .skip(skip)
                        .limit(parseInt(limit))
                        .lean(),
                    Contact.countDocuments(query)
                ]);

                console.log('Found contacts:', contacts.length, 'Total:', total);

                // Get status counts (respecting branch filter)
                const statusCounts = await Contact.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    }
                ]);

                const counts = {
                    all: total,
                    new: 0,
                    read: 0,
                    archived: 0
                };

                statusCounts.forEach(item => {
                    counts[item._id] = item.count;
                });

                return resolve({
                    success: true,
                    contacts,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(total / parseInt(limit)),
                        totalContacts: total,
                        limit: parseInt(limit)
                    },
                    counts
                });
            } catch (error) {
                console.error('getContacts error:', error);
                return resolve({
                    success: false,
                    error: 'Failed to fetch contacts',
                    contacts: [],
                    pagination: { currentPage: 1, totalPages: 0, totalContacts: 0, limit: 20 },
                    counts: { all: 0, new: 0, read: 0, archived: 0 }
                });
            }
        });
    },

    // Get single contact by ID
    getContactById: (req, res) => {
        return new Promise(async (resolve, reject) => {
            try {
                const { id } = req.params;

                const contact = await Contact.findById(id).lean();

                if (!contact) {
                    return resolve({
                        success: false,
                        error: 'Contact not found'
                    });
                }

                return resolve({
                    success: true,
                    contact
                });
            } catch (error) {
                console.error('getContactById error:', error);
                return resolve({
                    success: false,
                    error: 'Failed to fetch contact details'
                });
            }
        });
    },

    // Update contact status
    updateContactStatus: (req, res) => {
        return new Promise(async (resolve, reject) => {
            try {
                const { id } = req.params;
                const { status } = req.body;

                if (!['new', 'read', 'archived'].includes(status)) {
                    return resolve({
                        success: false,
                        error: 'Invalid status'
                    });
                }

                const updateData = { status };

                // Set readAt timestamp when marking as read
                if (status === 'read') {
                    updateData.readAt = new Date();
                }

                const contact = await Contact.findByIdAndUpdate(
                    id,
                    updateData,
                    { new: true }
                );

                if (!contact) {
                    return resolve({
                        success: false,
                        error: 'Contact not found'
                    });
                }

                return resolve({
                    success: true,
                    message: 'Contact status updated successfully',
                    contact
                });
            } catch (error) {
                console.error('updateContactStatus error:', error);
                return resolve({
                    success: false,
                    error: 'Failed to update contact status'
                });
            }
        });
    },

    // Delete contact
    deleteContact: (req, res) => {
        return new Promise(async (resolve, reject) => {
            try {
                const { id } = req.params;

                const contact = await Contact.findByIdAndDelete(id);

                if (!contact) {
                    return resolve({
                        success: false,
                        error: 'Contact not found'
                    });
                }

                return resolve({
                    success: true,
                    message: 'Contact deleted successfully'
                });
            } catch (error) {
                console.error('deleteContact error:', error);
                return resolve({
                    success: false,
                    error: 'Failed to delete contact'
                });
            }
        });
    }
};
