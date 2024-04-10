import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefereshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

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

    if(!username || !email){
        throw new ApiError(400, "username or email is required")
    }

    const user  = await User.findOne({
        $or : [{email}, {username}]
    })

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

const logOutUser = asyncHandler(async(req,res) => {
    /**
     * find user
     */
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            },
            
        },
        {
            new: true
        },

    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200).clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"))
})

export {
    registerUser,
    loginUser,
    logOutUser
}