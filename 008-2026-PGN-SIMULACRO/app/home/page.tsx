import { readFileSync } from 'fs';
import { join } from 'path';
import HomePageClient from '../../components/HomePageClient';

function getVersionInfo() {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    return {
      version: pkg.version || '0.0.0',
      build: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    };
  } catch {
    return { version: '0.0.0', build: '00000000' };
  }
}

export default function HomePage() {
  const { version, build } = getVersionInfo();
  return <HomePageClient version={version} build={build} />;
}
