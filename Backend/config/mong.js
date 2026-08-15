import mongoose from 'mongoose'
import dotenv from "dotenv";
dotenv.config();


const mong=()=>{
    mongoose.connect(process.env.DB).then(()=>console.log("db connected"))
}

export default mong;