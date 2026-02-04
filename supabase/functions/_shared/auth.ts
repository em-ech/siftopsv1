import { getServiceClient } from "./supabase.ts";

/**
 * User info extracted from JWT token
 */
export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
}

/**
 * Result of authentication check
 */
export interface AuthResult {
  authenticated: boolean;
  user: AuthUser | null;
  error?: string;
}

/**
 * Extract and validate the JWT token from request headers.
 * Returns user info if valid, null if invalid or missing.
 *
 * @param req - The incoming request
 * @returns AuthResult with user info or error
 */
export async function authenticateRequest(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return {
      authenticated: false,
      user: null,
      error: "Missing Authorization header",
    };
  }

  // Extract token from "Bearer <token>" format
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token) {
    return {
      authenticated: false,
      user: null,
      error: "Invalid Authorization header format",
    };
  }

  try {
    // Use Supabase to verify the token
    const supabase = getServiceClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return {
        authenticated: false,
        user: null,
        error: error?.message || "Invalid token",
      };
    }

    return {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  } catch (err) {
    return {
      authenticated: false,
      user: null,
      error: `Authentication error: ${err}`,
    };
  }
}

/**
 * Get user ID from request, returns null if not authenticated.
 * Use this for optional auth where anonymous access is allowed.
 */
export async function getUserIdOptional(req: Request): Promise<string | null> {
  const result = await authenticateRequest(req);
  return result.user?.id || null;
}

/**
 * Get user ID from request, throws if not authenticated.
 * Use this for required auth.
 */
export async function getUserIdRequired(req: Request): Promise<string> {
  const result = await authenticateRequest(req);

  if (!result.authenticated || !result.user) {
    throw new Error(result.error || "Authentication required");
  }

  return result.user.id;
}

/**
 * Extract auth header for passing to user-scoped Supabase client.
 */
export function getAuthHeader(req: Request): string | null {
  return req.headers.get("Authorization");
}

/**
 * Create an unauthorized response with proper CORS headers.
 */
export function unauthorizedResponse(
  message: string = "Unauthorized",
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({ ok: false, error: message }),
    {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
