import { NextRequest } from 'next/server';

export function assertAppPassword(request: NextRequest) {
  const configured = process.env.APP_PASSWORD;
  if (!configured) return;
  const received = request.headers.get('x-app-password');
  if (received !== configured) throw new Error('UNAUTHORIZED');
}
