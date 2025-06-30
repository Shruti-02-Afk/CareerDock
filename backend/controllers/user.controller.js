import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import getDataUri from "../utils/datauri.js";
import cloudinary from "../utils/cloudinary.js";


//Register
/*export const register = async (req, res) => {
    try{
        const {fullName, email, phoneNumber, password, role} = req.body;
        if(!fullName || !email || !phoneNumber || !password || !role){
            return res.status(400).json({
                message:"Something is missing",
                success:false
            });
        }
        const file = req.file;
        const fileUri = getDataUri(file);
        const cloudResponse = await cloudinary.uploader.upload(fileUri.content);

        const user = await User.findOne({email});
        if(user){
            return res.status(400).json({
                message:"User already exists with this email",
                success:false
            });
        }
        const hashedPassword = await bcrypt.hash(password, 12);

        await User.create({
            fullName,
            email,
            phoneNumber,
            password: hashedPassword,
            role,
            profile:{
                profilePhoto:cloudResponse.secure_url,
            }
        });


        return res.status(201).json({
            message: "Account created successfully",
            success: true
        });
    }catch(error){
        console.log(error);
    }
} 
*/

export const register = async (req, res) => {
    try {
        const { fullName, email, phoneNumber, password, role } = req.body;

        // Check for missing fields
        if (!fullName || !email || !phoneNumber || !password || !role) {
            return res.status(400).json({
                message: "All fields are required",
                success: false
            });
        }

        // Check for missing file
        const file = req.file;
        if (!file) {
            return res.status(400).json({
                message: "Profile image is required",
                success: false
            });
        }

        // Upload image to Cloudinary
        const fileUri = getDataUri(file);
        const cloudResponse = await cloudinary.uploader.upload(fileUri.content);

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                message: "User already exists with this email",
                success: false
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const newUser = await User.create({
            fullName,
            email,
            phoneNumber,
            password: hashedPassword,
            role,
            profile: {
                profilePhoto: cloudResponse.secure_url
            }
        });

        // Generate JWT token
        const tokenData = { userId: newUser._id };
        const token = jwt.sign(tokenData, process.env.SECRET_KEY);

        // Prepare user data for frontend
        const userToSend = {
            _id: newUser._id,
            fullName: newUser.fullName,
            email: newUser.email,
            phoneNumber: newUser.phoneNumber,
            role: newUser.role,
            profile: newUser.profile
        };

        // Set token cookie and send response
        return res.status(201)
            .cookie("token", token, {
                maxAge: 24 * 60 * 60 * 1000, // 1 day
                httpOnly: true,
                sameSite: "strict",
                // secure: true // Uncomment in production with HTTPS
            })
            .json({
                message: "Account created successfully",
                user: userToSend,
                success: true
            });

    } catch (error) {
        console.error("Error during registration:", error);
        return res.status(500).json({
            message: error.message || "Internal server error",
            success: false
        });
    }
};


//Login
export const login = async (req, res) => {
    try {
        const { email, password, role } = req.body;
        if (!email || !password || !role) {
            return res.status(400).json({
                message: "Something is missing.",
                success: false
            })
        }
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({
                message: "Incorrect email or password.",
                success: false
            })
        }
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(400).json({
                message: "Incorrect email or password.",
                success: false
            })
        }
        // check role is correct or not
        if (role !== user.role) {
            return res.status(400).json({
                message: "Account dosen't exist with current role.",
                success: false
            })
        }

        const tokenData = {
            userId: user._id
        }

        const token = await jwt.sign(tokenData, process.env.SECRET_KEY);

        user = {
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            profile: user.profile
        }

        return res.status(200).cookie("token", token, { maxAge: 1 * 24 * 60 * 60 * 1000, httpsOnly: true, sameSite: 'strict' }).json({
            message: `Welcome back ${user.fullName}`,
            user,
            success: true
        })
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Internal Server Error",
            success: false
        });
    }

}

//LogOut
export const logout = async (req, res) => {
    try {
        return res.status(200).cookie("token", "", { maxAge: 0 }).json({
            message: "Logged out successfully.",
            success: true
        })
    } catch (error) {
        console.log(error);
    }
}

//Update profile
export const updateProfile = async (req, res) => {
    try {
        const { fullName, email, phoneNumber, bio, skills } = req.body;
        const file = req.file;
        //cloudinary
        const fileUri = getDataUri(file);
        const cloudResponse = await cloudinary.uploader.upload(fileUri.content);


        let skillsArray;
        if (skills) {
            skillsArray = skills.split(",");
        }
        const userId = req.id;  // middleware authentication
        let user = await User.findById(userId);

        if (!user) {
            return res.status(400).json({
                message: "User not found.",
                success: false
            })
        }
        //updating data
        if (fullName) user.fullName = fullName
        if (email) user.email = email
        if (phoneNumber) user.phoneNumber = phoneNumber
        if (bio) user.profile.bio = bio
        if (skills) user.profile.skills = skillsArray

        // resume comes later here...
        if (cloudResponse) {
            user.profile.resume = cloudResponse.secure_url; //save the cloudinary url
            user.profile.resumeOriginalName = file.originalname;  // save the original file name
        }

        await user.save();

        user = {
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            profile: user.profile
        }
        return res.status(200).json({
            message: "Profile updated successfully.",
            user,
            success: true
        })
    } catch (error) {
        console.log(error);
    }
}