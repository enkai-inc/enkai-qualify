import { NextResponse } from 'next/server';
import packageJson from '../../../package.json';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'enkai-qualify-dashboard',
    version: packageJson.version,
  });
}
