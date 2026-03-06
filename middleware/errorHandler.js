const errorHandler = (err, req, res, next) => {
    const statusCode = err.status || 500;
    const message = err.message || 'Internal Server Error';

    // Log the error for server-side debugging
    console.error(`[Error] ${statusCode} - ${message}`);
    if (err.stack) console.error(err.stack);

    // Check if the request expects JSON (API call) or HTML (Page view)
    if (req.originalUrl.startsWith('/api') || req.headers.accept.includes('application/json')) {
        return res.status(statusCode).json({
            success: false,
            message: message,
            stack: process.env.NODE_ENV === 'production' ? null : err.stack
        });
    }

    // Render error page for browser requests
    res.status(statusCode).render('error/500', {
        title: 'Server Error',
        status: statusCode,
        message: message,
        error: process.env.NODE_ENV === 'production' ? {} : err
    });
};

module.exports = errorHandler;
