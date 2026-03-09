const Setting = require("../model/settingSchema");

const verifySetup = async (req, res, next) => {
    try {
        // Skip verification for setup routes and API calls to avoid infinite loops
        const skipPaths = [
            '/setup',
            '/api/setup',
            '/logout',
            '/login',
            '/api/auth'
        ];

        if (skipPaths.some(path => req.path.startsWith(path))) {
            return next();
        }

        // Skip verification if setup is already marked as complete in session
        if (req.session.isSetupComplete) {
            return next();
        }

        // Check database for setup status
        const settings = await Setting.findOne();

        if (!settings || !settings.isSetupComplete) {
            // If it's an API request, return error, otherwise redirect
            if (req.originalUrl.startsWith('/api') || req.headers.accept?.includes('application/json')) {
                return res.status(403).json({
                    success: false,
                    message: "Account setup required",
                    code: "SETUP_REQUIRED"
                });
            }
            return res.redirect("/setup");
        }

        // Mark in session for faster subsequent checks
        req.session.isSetupComplete = true;
        next();

    } catch (error) {
        console.error("Error in verifySetup middleware:", error);
        next(); // Continue on error to avoid locking out admin
    }
};

module.exports = verifySetup;
