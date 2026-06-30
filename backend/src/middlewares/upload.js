const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads/')),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname).toLowerCase())
});

const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedExt = /\.(pdf|jpg|jpeg|png|webp|csv)$/i;
        const allowedMimes = [
            'application/pdf', 
            'image/jpeg', 
            'image/jpg', 
            'image/png', 
            'image/webp', 
            'text/csv', 
            'application/csv', 
            'application/vnd.ms-excel'
        ];
        
        if (allowedExt.test(path.extname(file.originalname)) && allowedMimes.includes(file.mimetype.toLowerCase())) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, images, and CSV are allowed, and MIME type must match.'));
        }
    }
});

module.exports = upload;
