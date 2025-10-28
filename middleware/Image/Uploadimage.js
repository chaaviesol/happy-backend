const { S3, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
require('dotenv').config();
const express = require('express');
const productrouter = express.Router();

// Configure AWS SDK
const awsS3 = new S3({
  region: 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEYID,
    secretAccessKey: process.env.AWS_S3_SECRETACCESSKEY
  }
});

// Multer S3 configuration
const upload = multer({
  storage: multerS3({
    s3: awsS3,
    bucket: process.env.AWS_S3_ACCESS_BUCKET_NAME,
    key: function (req, file, cb) {
      cb(null, Date.now().toString() + '-' + file.originalname);
    }
  })
});

// Download file from S3 and return as buffer
async function downloadFileFromS3(fileUrl) {
  const params = {
    Bucket: process.env.AWS_S3_ACCESS_BUCKET_NAME,
    Key: fileUrl.split('/prod_images').pop() // Extract key from URL
  };

  try {
    const data = await awsS3.send(new GetObjectCommand(params));
    console.log("data", data)
    const chunks = [];
    for await (const chunk of data.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (error) {
    console.error("Error downloading file from S3:", error);
    throw error;
  }
}

async function downloadProdFileFromS3(fileUrl) {
  const key = fileUrl.split('.amazonaws.com/').pop(); // Extract the S3 key from URL
console.log("heyyyyyyyyyy")
  const params = {
    Bucket: process.env.AWS_S3_ACCESS_BUCKET_NAME,
    Key: key,
  };

  try {
    const data = await awsS3.send(new GetObjectCommand(params));
    const chunks = [];
    for await (const chunk of data.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (error) {
    console.error("Error downloading file from S3:", error);
    throw error;
  }
}


// Multipart upload function
async function multipartUpload(buffer, s3Key, contentType) {
  let uploadId;
  const s3UploadParams = {
    Bucket: process.env.AWS_S3_ACCESS_BUCKET_NAME,
    Key: s3Key,
    ContentType: contentType
  };

  try {
    console.time("uploading");
    const multipartUpload = await awsS3.send(new CreateMultipartUploadCommand(s3UploadParams));
    uploadId = multipartUpload.UploadId;

    const uploadPromises = [];
    const partSize = 1024 * 1024 * 5;
    const parts = Math.ceil(buffer.length / partSize);

    for (let i = 0; i < parts; i++) {
      const start = i * partSize;
      const end = Math.min(start + partSize, buffer.length);
      uploadPromises.push(
        awsS3.send(new UploadPartCommand({
          ...s3UploadParams,
          UploadId: uploadId,
          Body: buffer.slice(start, end),
          PartNumber: i + 1
        })).then(d => {
          console.log("Part", i + 1, "uploaded:", d);
          return d;
        })
      );
    }

    const uploadResults = await Promise.all(uploadPromises);

    const data = await awsS3.send(new CompleteMultipartUploadCommand({
      ...s3UploadParams,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: uploadResults.map(({ ETag }, i) => ({
          ETag,
          PartNumber: i + 1
        }))
      }
    }));
    console.log("completed:", data);
    console.timeEnd("uploading");
    return data;
  } catch (err) {
    console.error(err);
    if (uploadId) {
      const abortCommand = new AbortMultipartUploadCommand({
        ...s3UploadParams,
        UploadId: uploadId
      });
      await awsS3.send(abortCommand);
    }
  } finally {
    awsS3.destroy();
  }
}

// Middleware for compressing images using imagemin-mozjpeg
const compressImage = async (req, res, next) => {
  if (!req.file) return next();

  try {
    // Dynamically import imagemin for ES Module support
    const imagemin = await import('imagemin');
    const imageminMozjpeg = await import('imagemin-mozjpeg');

    const compressedBuffer = await imagemin.buffer(req.file.buffer, {
      plugins: [
        imageminMozjpeg.default({ quality: 80 }) // Use .default for CommonJS compatibility
      ]
    });

    req.file.buffer = compressedBuffer;
    next();
  } catch (err) {
    console.error("Error compressing image:", err);
    next(err);
  }
};


// const { S3, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
// const multer = require('multer');
// const multerS3 = require('multer-s3');
// require('dotenv').config();
// const stream = require('stream');
// const mime = require('mime');
// const express = require('express');
// const productrouter = express.Router();

// // Configure AWS SDK
// const awsS3 = new S3({
//   region: 'ap-south-1',
//   credentials: {
//     accessKeyId: process.env.AWS_S3_ACCESS_KEYID,
//     secretAccessKey: process.env.AWS_S3_SECRETACCESSKEY
//   }
// });

// // Multer S3 configuration
// const upload = multer({
//   storage: multerS3({
//     s3: awsS3,
//     bucket: process.env.AWS_S3_ACCESS_BUCKET_NAME,
//     key: function (req, file, cb) {
//       cb(null, Date.now().toString() + '-' + file.originalname);
//     }
//   })
// });

// // Download file from S3 and return as buffer
// async function downloadFileFromS3(fileUrl) {
//   const params = {
//     Bucket: process.env.AWS_S3_ACCESS_BUCKET_NAME,
//     Key: fileUrl.split('/prod_images').pop() // Extract key from URL
//   };

//   try {
//     const data = await awsS3.send(new GetObjectCommand(params));
//     console.log("data", data)
//     const chunks = [];
//     for await (const chunk of data.Body) {
//       chunks.push(chunk);
//     }
//     return Buffer.concat(chunks);
//   } catch (error) {
//     console.error("Error downloading file from S3:", error);
//     throw error;
//   }
// }

// // Multipart upload function
// async function multipartUpload(buffer, s3Key, contentType) {
//   let uploadId;
//   const s3UploadParams = {
//     Bucket: process.env.AWS_S3_ACCESS_BUCKET_NAME,
//     Key: s3Key,
//     ContentType: contentType
//   };

//   try {
//     console.time("uploading");
//     const multipartUpload = await awsS3.send(new CreateMultipartUploadCommand(s3UploadParams));
//     uploadId = multipartUpload.UploadId;

//     const uploadPromises = [];
//     const partSize = 1024 * 1024 * 5;
//     const parts = Math.ceil(buffer.length / partSize);

//     for (let i = 0; i < parts; i++) {
//       const start = i * partSize;
//       const end = Math.min(start + partSize, buffer.length);
//       uploadPromises.push(
//         awsS3.send(new UploadPartCommand({
//           ...s3UploadParams,
//           UploadId: uploadId,
//           Body: buffer.slice(start, end),
//           PartNumber: i + 1
//         })).then(d => {
//           console.log("Part", i + 1, "uploaded:", d);
//           return d;
//         })
//       );
//     }

//     const uploadResults = await Promise.all(uploadPromises);

//     const data = await awsS3.send(new CompleteMultipartUploadCommand({
//       ...s3UploadParams,
//       UploadId: uploadId,
//       MultipartUpload: {
//         Parts: uploadResults.map(({ ETag }, i) => ({
//           ETag,
//           PartNumber: i + 1
//         }))
//       }
//     }));
//     console.log("completed:", data);
//     console.timeEnd("uploading");
//     return data;
//   } catch (err) {
//     console.error(err);
//     if (uploadId) {
//       const abortCommand = new AbortMultipartUploadCommand({
//         ...s3UploadParams,
//         UploadId: uploadId
//       });
//       await awsS3.send(abortCommand);
//     }
//   } finally {
//     awsS3.destroy();
//   }
// }

module.exports = { upload, multipartUpload, downloadFileFromS3,compressImage,downloadProdFileFromS3 };

