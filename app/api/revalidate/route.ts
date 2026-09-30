import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST() {
  try {
    // পাবলিক বুকিং পেজের ক্যাশ পরিষ্কার করুন
    revalidatePath('/book/[slug]', 'page');
    return NextResponse.json({ revalidated: true });
  } catch (err) {
    return NextResponse.json({ error: 'Revalidation failed' }, { status: 500 });
  }
}