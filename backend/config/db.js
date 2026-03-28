import mongoose from 'mongoose';

const connectDB =async(req,res)=>{
    try{
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not configured');
        }

        await mongoose.connect(process.env.MONGO_URI, {
            maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 20),
            minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 2),
            serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 5000),
            socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS || 45000),
        });
        console.log('MongoDB connected...');
    }catch(err){
        console.error(err.message);
        process.exit(1);
    }
}

export default connectDB;