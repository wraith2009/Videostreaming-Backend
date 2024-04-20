import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefereshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        console.log(user);
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        console.log(accessToken, refreshToken);
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken , refreshToken}

    } catch (error) {
        throw new ApiError(500, "something went wrong while generating refresh and access tokens")
    }
}

const registerUser = asyncHandler( async (req, res) => {
    // res.status(200).json({
    //     message: "haa bhai seekh rha h backend"
    // })
     /**
      * for registering user 
      * 
      * take input from user : user details (from frontend)
      * validate email
      * validate password
      * validation after taking input.. - not empty
      * check if user is already registered: username and email
      * ckeck for images, check for avatar
      * upload them to cloudinary, avatar
      * create user object - create entry in db
      * remove password and refresh token field from response
      * check for user creation
      * return response
      */


    // getting user details from frontend:

    const {fullname, email, username, password} = req.body
    // console.log("email: ", email);

    //validation

    // if(fullname == ""){
    //     throw new ApiError(400, "fullname is required")
    // }
    if (
        [fullname, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    // check if user exists:

    const existedUser = await User.findOne({
        $or: [{username}, {email}]
    })

    if(existedUser){
        throw new ApiError(409, "User already exists")
    }

    //images

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
    
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    

    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
    }

    // create object and enter in db
    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering User")
    }

    //return response

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )

})

const loginUser = asyncHandler(async(req, res) => {
    /**
     * req body ->  data
     *  check if the email/username already exist
     * find user
     * password validation
     * access and refresh token generation
     * send cookie
     * response-> successfully login
     *  */

    //requesting data
    const {username, email, password} = req.body

    if(!username && !email){
        throw new ApiError(400, "username or email is required")
    }

    const user  = await User.findOne({
        $or : [{email}, {username}]
    })

    console.log(username);
    console.log(email);
    if(!user){
        throw new ApiError(404, "user doesnot exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials")
    }

    const {accessToken , refreshToken} = await generateAccessAndRefereshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken,
                refreshToken
            },
            "User logged In Successfully"
        )
    )
})

const logOutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})

const refreshAceessToken = asyncHandler(async(req, res) => { 
    const incomingRefreshtoken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshtoken){
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshtoken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = User.findById(decodedToken?._id)
        
        if(!user){
            throw new ApiError(401, "Invalid RefreshToken")
        }
    
        if(incomingRefreshtoken !== user?.refreshToken){
            throw new ApiError(401, "refreshToken is expired or used")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newrefreshToken} = await generateAccessAndRefereshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newrefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newrefreshToken},
                "Acccess token Refreshed"
    
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token")
    }
})

const changeCurrentPassword = asyncHandler(async(req, res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword) 

    if(!isPasswordCorrect){
        throw new ApiError(400, "Incorrect Password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res.status(200).json(new ApiResponse(200,{},"password Chnaged successfully"))
})

const getCurrentUser = asyncHandler(async(req, res)=> {
    return res.status(200).json(
        new ApiResponse(200, req.user, "current user fetched successfully")
    )
})

const updateAccountDetails = asyncHandler(async(req,res) => {
    const {email} = req.body

    if(!email){
        throw new ApiError(400, "All fields are required")
    }

    const user= User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                email: email
            }
        },
        {new : true}
    ).select("-password")

    return res.status(200).json(
        new ApiResponse(200, user, "Account details updated successfully")
    )
})

const updateUserAvatar =  asyncHandler(async(req,res) => {
    /**
     * req.file
    */
   const avatarLocalPath = req.file?.path

   if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar missing")
    }

    await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "Error while uploading on avatar")
    }

    await User.findByIdAndUpdate(
        req.use?._id,
        {
            $set: {avatar: avatar.url}
        },
        {
            new:true
        }
    ).select("-password")

    return res.status(200).json(
        new ApiResponse(200, user , "avatar image updated successfully")
    )
})

// will code coverImage later by own--
// to delete old imgae

const getUserChannelProfile = asyncHandler(async(req, res) => {
    const {username} = req.params

    if(!username?.trim()){
        throw new ApiError(400, "Invalid username")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullname: 1,
                username: 1,
                subscribersCount: 1,
                channelSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "Channel doesnot exist")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async(req,res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from : "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                        
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200).json(
        new ApiResponse(200, user[0].watchHistory, "watch History fetched successfully")
    )
})

export {
    registerUser,
    loginUser,
    logOutUser,
    refreshAceessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    getUserChannelProfile,
    getWatchHistory
}