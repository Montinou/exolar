/**
 * R2 Storage Utilities for MCP Server
 *
 * Generates signed URLs for downloading artifacts from Cloudflare R2.
 */

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

let r2Client: S3Client | null = null

function getR2Client() {
  if (r2Client) return r2Client

  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing R2 credentials. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY"
    )
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

/**
 * Generate a signed URL for downloading an artifact from R2.
 * @param key The R2 object key
 * @param expiresIn Expiration time in seconds (default 1 hour)
 */
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

/**
 * Check if R2 is configured with all required environment variables.
 */
export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  )
}
