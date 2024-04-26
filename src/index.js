// require('dotenv').config({path: './env'})
import dotenv from "dotenv";
import connectDB from "./db/index1.js";
import {app} from './app.js'

dotenv.config({path: './.env'})

connectDB()
.then(() => {
    console.log("database connection established");
    app.on('error', (err)=> {
        console.log("connection error" + err.message);
    })
    app.listen(process.env.PORT || 8000, () => {
        console.log(`server is running at ${process.env.PORT}`);
    })
})
.catch((err) => {
    console.log("DB conntection failed !!", err);
})

/**
 * using then and catch if database connection is failed then catch
 * will display the error message and we use then after connection 
 * DB and will use app.listen after using this our server will start.
 */




















/*
import express from "express";

const app = express();

//semicolon is used to avoid normal problem
;(async () => {
    try {
        await mongoose.connect(`${process.env.
        MONGODB_URI}/${DB_NAME}`)
        app.on("error", (error)=> {
            console.log("Err:", error);
            throw error
        })

        app.listen(process.env.PORT, () => {
            console.log(`App is listening on port ${process.env.PORT}`);
        })
    } catch (error) {
        console.log("Error:", error);
        throw err
    }
})()
*/