// Cloudflare R2 integration for signed URLs
// Add these environment variables to your project:
// - R2_ACCOUNT_ID
// - R2_ACCESS_KEY_ID
// - R2_SECRET_ACCESS_KEY
// - R2_BUCKET_NAME

import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

let r2Client: S3Client | null = null

function getR2Client() {
  if (r2Client) return r2Client

  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2 credentials. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY")
  }

  r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })

  return r2Client
}

export async function getSignedR2Url(key: string, expiresIn = 3600): Promise<string> {
  const client = getR2Client()
  const bucketName = process.env.R2_BUCKET_NAME

  if (!bucketName) {
    throw new Error("Missing R2_BUCKET_NAME environment variable")
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  })

  const signedUrl = await getSignedUrl(client, command, { expiresIn })
  return signedUrl
}

export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  )
}

/**
 * Upload a file to R2 storage
 * @param key The R2 key (path) to store the file at
 * @param data The file data as a Buffer
 * @param contentType The MIME type of the file
 * @returns The R2 key of the uploaded file
 */
export async function uploadToR2(
  key: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  const client = getR2Client()
  const bucketName = process.env.R2_BUCKET_NAME

  if (!bucketName) {
    throw new Error("Missing R2_BUCKET_NAME environment variable")
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: data,
    ContentType: contentType,
  })

  await client.send(command)
  return key
}

/**
 * Generate a unique R2 key for an artifact
 * Format: artifacts/{execution_id}/{test_signature}/{type}/{filename}
 */
export function generateArtifactKey(
  executionId: number,
  testSignature: string,
  type: string,
  filename: string
): string {
  // Sanitize the test signature for use in path
  const sanitizedSignature = testSignature
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .substring(0, 100)

  return `artifacts/${executionId}/${sanitizedSignature}/${type}/${filename}`
}
