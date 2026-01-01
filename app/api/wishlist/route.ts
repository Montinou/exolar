import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { addToWishlist } from "@/lib/db-wishlist"

// Validation schema for wishlist submission
const wishlistSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  name: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validation = wishlistSchema.safeParse(body)
    if (!validation.success) {
      const errorMessage = validation.error.issues
        .map((issue) => issue.message)
        .join(", ")
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    const { email, name } = validation.data

    // Add to wishlist
    const result = await addToWishlist(email, name)

    if (!result.success) {
      return NextResponse.json({ error: result.reason }, { status: 409 })
    }

    return NextResponse.json(
      { message: "Successfully added to wishlist" },
      { status: 201 }
    )
  } catch (error) {
    console.error("Wishlist API error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
