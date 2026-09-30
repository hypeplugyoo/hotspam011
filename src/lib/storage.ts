import { S3Client } from "@aws-sdk/client-s3";

const credentials = () => ({ accessKeyId: process.env.S3_ACCESS_KEY ?? "", secretAccessKey: process.env.S3_SECRET_KEY ?? "" });
export const s3 = new S3Client({ region: process.env.S3_REGION ?? "us-east-1", endpoint: process.env.S3_ENDPOINT, forcePathStyle: true, credentials: credentials() });
export const s3Browser = new S3Client({ region: process.env.S3_REGION ?? "us-east-1", endpoint: process.env.S3_BROWSER_ENDPOINT ?? process.env.S3_ENDPOINT, forcePathStyle: true, credentials: credentials() });
export const mediaBucket = process.env.S3_BUCKET ?? "media";
