import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const csvPath = path.join(process.cwd(), 'bus_routes.csv');
    const fileContent = await fs.readFile(csvPath, 'utf8');
    
    const lines = fileContent.split('\n');
    const routes: Record<string, { from: string; to: string }> = {};
    
    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const [plate, from, to] = line.split(',').map(p => p.trim());
      if (plate && from && to) {
        routes[plate.toUpperCase().replace(/\s+/g, '')] = { from, to };
      }
    }
    
    return NextResponse.json(routes);
  } catch (error) {
    console.error('Error reading bus_routes.csv:', error);
    return NextResponse.json({}, { status: 500 });
  }
}
