import { v2 as cloudinary } from "cloudinary";

// Configure from environment variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UploadResult {
    url: string;
    publicId: string;
}

/**
 * Upload a file buffer to Cloudinary
 */
export async function uploadToCloudinary(
    buffer: Buffer,
    folder: string = "slips"
): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
        cloudinary.uploader
            .upload_stream(
                {
                    folder,
                    resource_type: "image",
                    format: "webp", // Convert to webp for smaller size
                    transformation: [
                        { width: 1200, crop: "limit" }, // Limit max width
                        { quality: "auto" },
                    ],
                },
                (error, result) => {
                    if (error) {
                        reject(error);
                    } else if (result) {
                        resolve({
                            url: result.secure_url,
                            publicId: result.public_id,
                        });
                    } else {
                        reject(new Error("Upload failed - no result"));
                    }
                }
            )
            .end(buffer);
    });
}

/**
 * Delete an image from Cloudinary by public ID
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
}

export default cloudinary;
