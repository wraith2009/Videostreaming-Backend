// require('dotenv').config({path: './env'})
import dotenv from "dotenv";
import connectDB from "./db/index1.js";
import {app} from './app.js'

dotenv.config({path: './.env'})

connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`server is running at ${process.env.PORT}`);
    })
})
.catch((err) => {
    console.log("DB conntection failed !!", err);
})





















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