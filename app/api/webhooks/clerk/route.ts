import { NextRequest, NextResponse } from "next/server"
import { Webhook } from "svix"
import { getSql } from "@/lib/db"

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error("[clerk-webhook] CLERK_WEBHOOK_SECRET not configured")
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
  }

  const body = await request.text()
  const svixId = request.headers.get("svix-id")
  const svixTimestamp = request.headers.get("svix-timestamp")
  const svixSignature = request.headers.get("svix-signature")

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 })
  }

  let event: { type: string; data: Record<string, unknown> }

  try {
    const wh = new Webhook(WEBHOOK_SECRET)
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as { type: string; data: Record<string, unknown> }
  } catch (err) {
    console.error("[clerk-webhook] Signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const sql = getSql()

  try {
    switch (event.type) {
      case "user.created": {
        const { id, email_addresses, first_name, last_name } = event.data as {
          id: string
          email_addresses: Array<{ email_address: string }>
          first_name: string | null
          last_name: string | null
        }
        const email = email_addresses?.[0]?.email_address
        if (!email) break

        const name = [first_name, last_name].filter(Boolean).join(" ") || email.split("@")[0]

        // Only create if user doesn't exist (might have been pre-created via invite)
        await sql`
          INSERT INTO dashboard_users (email, clerk_user_id, name, role)
          VALUES (${email}, ${id}, ${name}, 'viewer')
          ON CONFLICT (email) DO UPDATE SET clerk_user_id = ${id}
        `
        console.log(`[clerk-webhook] user.created: ${email} (${id})`)
        break
      }

      case "user.updated": {
        const { id, email_addresses } = event.data as {
          id: string
          email_addresses: Array<{ email_address: string }>
        }
        const email = email_addresses?.[0]?.email_address
        if (!email) break

        await sql`
          UPDATE dashboard_users SET email = ${email} WHERE clerk_user_id = ${id}
        `
        console.log(`[clerk-webhook] user.updated: ${id}`)
        break
      }

      case "user.deleted": {
        const { id } = event.data as { id: string }
        await sql`
          DELETE FROM dashboard_users WHERE clerk_user_id = ${id}
        `
        console.log(`[clerk-webhook] user.deleted: ${id}`)
        break
      }

      case "organization.created": {
        const { id, name, slug } = event.data as { id: string; name: string; slug: string }
        await sql`
          INSERT INTO organizations (name, slug, clerk_org_id)
          VALUES (${name}, ${slug}, ${id})
          ON CONFLICT (clerk_org_id) DO UPDATE SET name = ${name}, slug = ${slug}
        `
        console.log(`[clerk-webhook] organization.created: ${name} (${id})`)
        break
      }

      case "organization.updated": {
        const { id, name, slug } = event.data as { id: string; name: string; slug: string }
        await sql`
          UPDATE organizations SET name = ${name}, slug = ${slug} WHERE clerk_org_id = ${id}
        `
        console.log(`[clerk-webhook] organization.updated: ${id}`)
        break
      }

      case "organization.deleted": {
        const { id } = event.data as { id: string }
        await sql`
          DELETE FROM organizations WHERE clerk_org_id = ${id}
        `
        console.log(`[clerk-webhook] organization.deleted: ${id}`)
        break
      }

      case "organizationMembership.created": {
        const { organization, public_user_data, role } = event.data as {
          organization: { id: string }
          public_user_data: { user_id: string }
          role: string
        }

        // Resolve Clerk IDs to internal integer IDs
        const userResult = await sql`
          SELECT id FROM dashboard_users WHERE clerk_user_id = ${public_user_data.user_id}
        `
        const orgResult = await sql`
          SELECT id FROM organizations WHERE clerk_org_id = ${organization.id}
        `

        if (userResult.length > 0 && orgResult.length > 0) {
          const userId = userResult[0].id as number
          const orgId = orgResult[0].id as number
          const orgRole = role === "org:admin" ? "admin" : "viewer"

          await sql`
            INSERT INTO organization_members (user_id, organization_id, role)
            VALUES (${userId}, ${orgId}, ${orgRole})
            ON CONFLICT (user_id, organization_id) DO UPDATE SET role = ${orgRole}
          `

          // Set as default org if user doesn't have one
          await sql`
            UPDATE dashboard_users SET default_org_id = ${orgId}
            WHERE id = ${userId} AND default_org_id IS NULL
          `

          console.log(`[clerk-webhook] membership.created: user ${userId} -> org ${orgId} (${orgRole})`)
        }
        break
      }

      case "organizationMembership.deleted": {
        const { organization, public_user_data } = event.data as {
          organization: { id: string }
          public_user_data: { user_id: string }
        }

        const userResult = await sql`
          SELECT id FROM dashboard_users WHERE clerk_user_id = ${public_user_data.user_id}
        `
        const orgResult = await sql`
          SELECT id FROM organizations WHERE clerk_org_id = ${organization.id}
        `

        if (userResult.length > 0 && orgResult.length > 0) {
          await sql`
            DELETE FROM organization_members
            WHERE user_id = ${userResult[0].id} AND organization_id = ${orgResult[0].id}
          `
          console.log(`[clerk-webhook] membership.deleted: user ${userResult[0].id} from org ${orgResult[0].id}`)
        }
        break
      }

      default:
        console.log(`[clerk-webhook] Unhandled event: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error(`[clerk-webhook] Error processing ${event.type}:`, error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
