/**
 * OpenAI API Proxy Helper
 * 
 * This module provides a consistent interface for calling OpenAI API
 * through the Vercel serverless proxy to avoid CORS issues.
 */

/**
 * Get the API proxy endpoint URL based on environment
 */
export function getProxyEndpoint(): string {
  // Check if we're in development mode
  const isDev = import.meta.env.DEV;
  
  if (isDev) {
    // Use Vercel dev server (run with: vercel dev)
    return 'http://localhost:3000/api/openai';
  } else {
    // Use deployed Vercel function
    // This will be your Vercel deployment URL
    return '/api/openai'; // Relative path works when deployed on same domain
  }
}

export interface OpenAIProxyRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  apiKey: string;
}

export interface OpenAIProxyResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
    index: number;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Call OpenAI API through the proxy
 */
export async function callOpenAIProxy(request: OpenAIProxyRequest): Promise<OpenAIProxyResponse> {
  const endpoint = getProxyEndpoint();
  
  console.log('[OpenAI Proxy] Calling endpoint:', endpoint);
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `Proxy error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}





