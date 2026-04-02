import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const logPath = path.join(process.cwd(), 'detections_log.csv');
    const fileContent = await fs.readFile(logPath, 'utf8');
    return new Response(fileContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="detections_log.csv"'
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Log file not found' }, { status: 404 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { plate, platform, timeIn, timeOut, from, to } = data;
    
    const logPath = path.join(process.cwd(), 'detections_log.csv');
    
    // Check if file exists to add header
    let exists = false;
    try {
      await fs.access(logPath);
      exists = true;
    } catch (e) {}
    
    const header = 'Plate,Platform,Time In,Time Out,From,To\n';
    const row = `${plate},${platform},${timeIn},${timeOut},${from},${to}\n`;
    
    if (!exists) {
      await fs.writeFile(logPath, header + row, 'utf8');
    } else {
      await fs.appendFile(logPath, row, 'utf8');
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error logging detection:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
