import { NextRequest, NextResponse } from 'next/server';
import { sendSigningEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { email, name, documentName, token } = await req.json();

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const signingLink = `${baseUrl}/sign/${token}`;

    // ensure function is called
    await sendSigningEmail(email, name, documentName, signingLink);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Email Send Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
