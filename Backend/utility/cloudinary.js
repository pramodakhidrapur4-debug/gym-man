import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUD_ID,
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SEC,
});

export const uploadToCloudinary = async (fileStr, folder = "gym_members") => {
  try {
    if (!fileStr) return { url: "", public_id: "" };

    if (fileStr.startsWith("http://") || fileStr.startsWith("https://")) {
      return { url: fileStr, public_id: "" }; // Already a remote URL
    }

    const uploadResponse = await cloudinary.uploader.upload(fileStr, {
      folder: folder,
      resource_type: "auto",
    });

    return {
      url: uploadResponse.secure_url,
      public_id: uploadResponse.public_id,
    };
  } catch (error) {
    console.error("Cloudinary upload fallback:", error.message);
    return {
      url: fileStr || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      public_id: "",
    };
  }
};

export const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) return;
    await cloudinary.uploader.destroy(publicId);
    console.log(`Cloudinary image ${publicId} removed safely.`);
  } catch (error) {
    console.error("Cloudinary delete warning (safe fallback):", error.message);
  }
};

export default cloudinary;
