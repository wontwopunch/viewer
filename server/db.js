const mongoose = require('mongoose');

// DigitalOcean 클러스터에서 제공한 연결 문자열 사용
const connectionString = 'mongodb+srv://doadmin:5WhxJ7z63820M1qs@db-mongodb-sgp1-31385-27362b68.mongo.ondigitalocean.com/admin?authSource=admin&retryWrites=true&w=majority';

// MongoDB 연결 함수
const connectDB = async () => {
    try {
        await mongoose.connect(connectionString, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB 연결 오류:', error);
        process.exit(1);
    }
};

module.exports = connectDB;
