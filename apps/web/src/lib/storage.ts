import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "",
    secretAccessKey: process.env.S3_SECRET_KEY || "",
  },
  forcePathStyle: true, // Required for MinIO
});

const BUCKET_UPLOADS = process.env.S3_BUCKET_UPLOADS || "racing-coach-uploads";
const BUCKET_GENERATED =
  process.env.S3_BUCKET_GENERATED || "racing-coach-generated";

export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
  bucket: "uploads" | "generated" = "uploads"
): Promise<string> {
  const bucketName =
    bucket === "uploads" ? BUCKET_UPLOADS : BUCKET_GENERATED;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  return key;
}

export async function getPresignedUrl(
  key: string,
  bucket: "uploads" | "generated" = "uploads",
  expiresIn: number = 3600
): Promise<string> {
  const bucketName =
    bucket === "uploads" ? BUCKET_UPLOADS : BUCKET_GENERATED;

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return getSignedUrl(s3, command, { expiresIn });
}

export { s3, BUCKET_UPLOADS, BUCKET_GENERATED };
