import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types/api'

export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json<ApiResponse<T>>({ data }, { status })
}

export function errorResponse(code: string, message: string, status: number = 400, details?: unknown) {
  return NextResponse.json<ApiResponse>({
    error: { code, message, details }
  }, { status })
}

export function unauthorizedResponse(message: string = 'Authentication required') {
  return errorResponse('UNAUTHORIZED', message, 401)
}

export function forbiddenResponse(message: string = 'Access denied') {
  return errorResponse('FORBIDDEN', message, 403)
}

export function notFoundResponse(resource: string = 'Resource') {
  return errorResponse('NOT_FOUND', `${resource} not found`, 404)
}

export function validationErrorResponse(message: string, details?: unknown) {
  return errorResponse('VALIDATION_ERROR', message, 400, details)
}