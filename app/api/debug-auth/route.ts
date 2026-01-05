import { NextResponse } from "next/server"
import { authServer } from "@/lib/auth/server"

export async function GET() {
  console.log("Auth Server keys:", Object.keys(authServer))
  // @ts-ignore
  if (authServer.api) {
     // @ts-ignore
     console.log("Auth Server API keys:", Object.keys(authServer.api))
  }
  return NextResponse.json({ keys: Object.keys(authServer) })
}
