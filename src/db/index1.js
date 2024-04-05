import mongoose from "mongoose";
import { DB_NAME } from "../constant.js";

const connectDB = async () => {
    try {
        const conenctionInstance = await mongoose.connect
        (`${process.env.MONGODB_URI}/${DB_NAME}`);
        console.log(`\n MONGODB connected !! DB HOST: ${conenctionInstance.connection.host}`);
    } catch (error) {
        console.log("MONGODB CONNECTION FAILED", error);
        process.exit(1);
    }
}

export default connectDB