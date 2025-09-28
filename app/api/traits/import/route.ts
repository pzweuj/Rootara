import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { input_data } = await request.json()

    console.log("Received import request with data:", input_data)

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

    console.log("Parsed traits data:", traitsData)

    // Send the parsed data directly to the backend
    const response = await fetch(
      `${process.env.ROOTARA_BACKEND_URL}/traits/import`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          "x-api-key": process.env.ROOTARA_BACKEND_API_KEY || "",
        },
        body: JSON.stringify(traitsData),
      }
    )

    console.log("Backend response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Backend error response:", errorText)
      throw new Error(`Backend API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log("Backend response data:", data)
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
