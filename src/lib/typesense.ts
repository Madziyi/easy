import Typesense from 'typesense';

/**
 * Utility to parse the TYPESENSE_HOST env var.
 * Handles both simple hostnames and full URLs.
 */
const getTypesenseConfig = () => {
  const rawHost = process.env.TYPESENSE_HOST || 'localhost';
  const apiKey = process.env.TYPESENSE_ADMIN_API_KEY;

  if (!apiKey) {
    throw new Error('TYPESENSE_ADMIN_API_KEY is not defined in environment variables.');
  }

  // Parse protocol, host, and port
  const protocol = rawHost.startsWith('https') ? 'https' : 'http';
  const hostOnly = rawHost.replace(/^https?:\/\//, '').split(':')[0];
  const port = parseInt(rawHost.split(':').pop() || '8108', 10);

  return {
    nodes: [
      {
        host: hostOnly,
        port: port,
        protocol: protocol,
      },
    ],
    apiKey: apiKey,
    connectionTimeoutSeconds: 5,
  };
};

// Singleton client instance
export const typesenseClient = new Typesense.Client(getTypesenseConfig());