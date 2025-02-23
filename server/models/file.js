const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
    name: String,
    path: String,
    public: { type: Boolean, default: true },
    uploadDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('File', FileSchema); 