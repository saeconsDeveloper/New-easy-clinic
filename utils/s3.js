"use strict";
const { v4: uuidv4 } = require("uuid");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  // ListObjectsV2Command,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
require("dotenv").config();

const {
  BUCKET_NAME,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  NODE_ENV,
} = process.env;

// ------------ S3 Client ------------
const s3 = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

// ------------ Helpers ------------
function gbToBytes(gb) {
  return gb * 1073741824; // 1 GB = 1073741824 bytes
}

/**
 * Accepts either a plain Key (e.g. "labReports/3/file.pdf")
 * or a full s3 URL (e.g. "s3://my-bucket/labReports/3/file.pdf")
 * and returns a { Bucket, Key } pair. Leading slashes removed; URL-decoding applied once.
 */
function resolveBucketAndKey(rawKey, fallbackBucket) {
  if (!rawKey) return { Bucket: fallbackBucket, Key: "" };

  let Bucket = (fallbackBucket || "").trim();
  let Key = String(rawKey).trim();

  if (Key.startsWith("s3://")) {
    const withoutScheme = Key.slice(5);
    const slash = withoutScheme.indexOf("/");
    if (slash > 0) {
      Bucket = withoutScheme.slice(0, slash);
      Key = withoutScheme.slice(slash + 1);
    }
  }

  if (Key.startsWith("/")) Key = Key.slice(1);
  try { Key = decodeURIComponent(Key); } catch (_) {}

  return { Bucket, Key };
}

// ------------ Upload ------------
/**
 * Upload a file (from multer memory storage) to S3 under filePath/
 * @param {Object} file - { originalname, mimetype, size, buffer }
 * @param {String} filePath - e.g. "labReports/3"
 * @returns {{ key: string, fileName: string }}
 */
async function uploadFileToS3(file, filePath) {
  try {
    const key = `${filePath}/${uuidv4()}-${file.originalname}`;
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      // ACL: "public-read",
    };

    await s3.send(new PutObjectCommand(params));
    if (NODE_ENV !== "production") {
      console.debug("[S3 upload] bucket=%s key=%s type=%s size=%d",
        BUCKET_NAME, key, file.mimetype, file.size);
    }

    return { key, fileName: file.originalname };
  } catch (error) {
    console.error("Upload Error:", error);
    throw new Error("Something went wrong during upload.");
  }
}

// ------------ Presign (GET) ------------
/**
 * Generate a temporary presigned URL for downloading an S3 object.
 * Accepts either a Key or a full s3:// URL.
 * @param {String} rawKey
 * @param {Number} expiry seconds (max 604800 = 7 days)
 * @returns {{ url: string, expiresIn: number, contentLength?: number, contentType?: string, eTag?: string }}
 */
async function getTemporaryUrl(rawKey, expiry = 604800) {
  const { Bucket, Key } = resolveBucketAndKey(rawKey, BUCKET_NAME);

  if (!Bucket || !Key) throw new Error("Missing S3 Bucket/Key");

  if (NODE_ENV !== "production") {
    console.debug("[S3 presign] bucket=%s key=%s region=%s", Bucket, Key, AWS_REGION);
  }

  try {
    // 1) Verify object exists & get metadata
    const head = await s3.send(new HeadObjectCommand({ Bucket, Key }));

    // 2) Presign only after HEAD succeeds
    const cmd = new GetObjectCommand({ Bucket, Key });
    const url = await getSignedUrl(s3, cmd, { expiresIn: expiry });

    return {
      url,
      expiresIn: expiry,
      contentLength: head.ContentLength,
      contentType: head.ContentType,
      eTag: head.ETag,
    };
  } catch (err) {
    const status = err?.$metadata?.httpStatusCode;
    const code = err?.name || err?.Code || "UnknownError";
    console.error("[S3 presign error]", {
      code,
      status,
      bucket: Bucket,
      key: Key,
      msg: err?.message,
    });

    if (status === 404) {
      throw new Error(`S3 object not found: ${Bucket}/${Key}`);
    }
    if (code === "AuthorizationHeaderMalformed" || code === "InvalidRequest") {
      throw new Error(
        "S3 request failed (possible region mismatch). Ensure AWS_REGION matches the bucket's region."
      );
    }

    throw new Error(`S3 error (${code}). ${err?.message || ""}`.trim());
  }
}

// ------------ Delete ------------
async function deleteFromS3(rawKey) {
  const { Bucket, Key } = resolveBucketAndKey(rawKey, BUCKET_NAME);
  if (!Bucket || !Key) throw new Error("Missing S3 Bucket/Key");

  try {
    await s3.send(new DeleteObjectCommand({ Bucket, Key }));
    if (NODE_ENV !== "production") {
      console.debug("[S3 delete] bucket=%s key=%s", Bucket, Key);
    }
    return true;
  } catch (error) {
    console.error("[S3 delete error]", error);
    throw new Error("Something went wrong while deleting.");
  }
}

// // ------------ Optional: folder size -------------
// async function getCurrentFolderSize(prefix) {
//   let totalSize = 0;
//   const params = { Bucket: BUCKET_NAME, Prefix: prefix };
//   try {
//     const data = await s3.send(new ListObjectsV2Command(params));
//     if (data.Contents) for (const o of data.Contents) totalSize += o.Size;
//   } catch (err) {
//     console.error("Error fetching objects from S3:", err);
//     throw new Error("Something went wrong while fetching storage.");
//   }
//   return totalSize; // bytes
// }

module.exports = {
  uploadFileToS3,
  getTemporaryUrl,
  deleteFromS3,
  gbToBytes,
  // getCurrentFolderSize,
};
