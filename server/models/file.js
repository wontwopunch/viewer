const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    fileId: {
        type: String,
        required: true,
        unique: true
    },
    originalName: {
        type: String,
        required: true
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
}, {
    collection: 'files'  // 컬렉션 이름을 명시적으로 지정
});

module.exports = mongoose.model('File', fileSchema); 