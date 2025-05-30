const mongoose = require("mongoose");
require("dotenv").config();

const DEFAULT_URI = "mongodb://localhost:27017/workspace";

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || DEFAULT_URI;
        await mongoose.connect(uri);
        console.log("✅ MongoDB Connected");
    } catch (err) {
        console.error("❌ MongoDB Connection Error:", err);
        process.exit(1);
    }
};

module.exports = connectDB;