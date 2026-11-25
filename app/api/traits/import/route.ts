import { NextResponse } from "next/server"

import {
  backendFetch,
  proxyBackendResponse,
  requireApiAuth,
} from "@/lib/backend-client"

export async function POST(request: Request) {
  const unauthorized = await requireApiAuth()
  if (unauthorized) {
    return unauthorized
  }

  try {
    const { input_data } = await request.json()

    // Parse the JSON data to validate and transform it
    let traitsData
    try {
      traitsData = JSON.parse(input_data)
    } catch (parseError) {
      console.error("Failed to parse input_data as JSON:", parseError)
      return NextResponse.json(
        { error: "Invalid JSON format in input_data" },
        { status: 400 }
      )
    }

    if (!Array.isArray(traitsData)) {
      return NextResponse.json(
        { error: "Input data must be an array of traits" },
        { status: 400 }
      )
    }

    // Send the parsed data directly to the backend
    const response = await backendFetch("/traits/import", {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(traitsData),
    })

    if (!response.ok) {
      return proxyBackendResponse(response)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in traits/import API:", error)
    return NextResponse.json(
      {
        error: `Failed to import traits: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 }
    )
  }
}
