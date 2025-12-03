import { GoogleGenAI, Type } from "@google/genai";
import { ShapeType, Shape } from "../types";

// Initialize the client
// API key is guaranteed to be available in process.env.API_KEY per instructions.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const modelName = "gemini-2.5-flash";

export const generateShapesFromPrompt = async (
  userPrompt: string,
  currentShapes: Shape[]
): Promise<Shape[]> => {
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `
        You are a CNC machine assistant. The user wants to generate shapes for a CNC operation.
        Current shapes in workspace: ${JSON.stringify(currentShapes)}
        
        User Request: "${userPrompt}"
        
        Generate a list of simple geometric shapes (Rectangle, Circle, Text) to fulfill the request.
        Coordinates are in millimeters. 
        Assume the workspace is 500x500mm.
        Return ONLY the new list of shapes including any old ones if they should be kept (or modified).
        Do not remove existing shapes unless explicitly asked.
        Ensure IDs are unique strings.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              type: { type: Type.STRING, enum: [ShapeType.RECTANGLE, ShapeType.CIRCLE, ShapeType.TEXT] },
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
              width: { type: Type.NUMBER, nullable: true },
              height: { type: Type.NUMBER, nullable: true },
              radius: { type: Type.NUMBER, nullable: true },
              text: { type: Type.STRING, nullable: true },
              fontSize: { type: Type.NUMBER, nullable: true },
            },
            required: ["id", "type", "x", "y"],
          },
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) return currentShapes;

    const newShapes = JSON.parse(jsonText) as Shape[];
    return newShapes;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const explainGCode = async (gcode: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `Explain what this CNC G-code does in simple terms suitable for a machinist. Highlight any potential safety issues.\n\n${gcode.substring(0, 5000)}`,
    });
    return response.text || "Could not generate explanation.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error connecting to AI service.";
  }
};
