// upload image and return image url

import axios from "axios";

export const imageUpload = async (imageData) => {
  // Send image data to imgbb
  const formData = new FormData();
  formData.append("image", imageData);
  const { data } = await axios.post(
    `https://api.imgbb.com/1/upload?key=${import.meta.env.VITE_IMGBB_API_KEY}`,
    formData
  )
   
  return data.data.display_url
};