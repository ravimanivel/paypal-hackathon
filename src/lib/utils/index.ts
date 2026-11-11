import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: unknown;
}

export function apiSuccess<T>(
  data: T,
  message = "Operation completed successfully",
  status = 200
) {
  return NextResponse.json<ApiSuccessResponse<T>>(
    {
      success: true,
      message,
      data,
    },
    { status }
  );
}

export function apiError(
  message: string,
  status = 400,
  errors?: unknown
) {
  return NextResponse.json<ApiErrorResponse>(
    {
      success: false,
      message,
      ...(errors ? { errors } : {}),
    },
    { status }
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    return apiError(
      firstIssue ? `${firstIssue.path.join(".")}: ${firstIssue.message}` : "Validation failed",
      400,
      error.flatten().fieldErrors
    );
  }

  if (error instanceof AppError) {
    return apiError(error.message, error.statusCode);
  }

  console.error("[AgentGuard API Error]:", error instanceof Error ? error.message : "Unknown error");
  return apiError("An unexpected server error occurred", 500);
}

export class AppError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}

