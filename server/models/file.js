const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    fileId: {
        type: String,
        required: true,
        unique: true
    },
    width: {
        type: Number,
        required: true
    },
    height: {
        type: Number,
        required: true
    },
    uploadDate: {
        type: Date,
        default: Date.now
    },
    public: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('File', fileSchema); 