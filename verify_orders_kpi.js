const mongoose = require('mongoose');
const orderHelper = require('./helper/orderHelper');

async function verifyOrdersKPIs() {
    try {
        await mongoose.connect('mongodb://localhost:27017/iGrab_DB');
        console.log('Connected to iGrab_DB');

        // Mock req/res
        const req = {
            session: {
                admin: {
                    selectedBranch: '695ff0540a18f073aa0aa358' // Correct Main Branch ID
                }
            },
            query: {
                page: 1,
                limit: 10
            }
        };

        const res = {
            status: function (code) {
                this.statusCode = code;
                return this;
            },
            json: function (data) {
                console.log('API Response Status:', this.statusCode);
                console.log('KPI Stats:', JSON.stringify(data.data.stats, null, 2));
                process.exit(0);
            }
        };

        await orderHelper.getOrderByFilter(req, res);

    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
}

verifyOrdersKPIs();
