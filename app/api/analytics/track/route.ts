import { NextRequest, NextResponse } from 'next/server';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Log the incoming real-time telemetry from tripinn-demo.vercel.app
    console.log('[Website Telemetry Received]:', {
      type: body.type || 'page_view',
      path: body.path || '/',
      referrer: body.referrer || 'direct',
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      { ok: true, received: true },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch {
    return NextResponse.json(
      { ok: false },
      {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
