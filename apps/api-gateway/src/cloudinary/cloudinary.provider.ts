import { v2 as cloudinary } from 'cloudinary';
import { appConfig } from 'config/configuration';

export const CLOUDINARY = 'CLOUDINARY';

export const CloudinaryProvider = {
  provide: CLOUDINARY,
  useFactory: () => {
    cloudinary.config({
      cloud_name: appConfig.cloudinary.cloudName,
      api_key: appConfig.cloudinary.apiKey,
      api_secret: appConfig.cloudinary.apiSecret,
    });
    return cloudinary;
  },
};
