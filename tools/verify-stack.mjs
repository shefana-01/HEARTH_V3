#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

console.log('=== Hearth Docker Compose Stack Verification ===\n');

const composePath = resolve(process.cwd(), 'docker-compose.yml');
if (!existsSync(composePath)) {
  console.error('FAIL: docker-compose.yml not found in working directory');
  process.exit(1);
}

const composeContent = readFileSync(composePath, 'utf8');

const requiredServices = [
  'postgres',
  'kafka',
  'neo4j',
  'mailpit',
  'family-service',
  'task-service',
  'decision-service',
  'care-service',
  'notification-service',
  'audit-service',
  'gateway',
  'web'
];

let missing = 0;
for (const service of requiredServices) {
  if (composeContent.includes(`  ${service}:`)) {
    console.log(`[OK] Service configured: ${service}`);
  } else {
    console.error(`[FAIL] Missing service: ${service}`);
    missing++;
  }
}

const requiredFiles = [
  'backend/Dockerfile',
  'frontend/Dockerfile',
  'infrastructure/init-db/01-init-databases.sql'
];

for (const file of requiredFiles) {
  const filePath = resolve(process.cwd(), file);
  if (existsSync(filePath)) {
    console.log(`[OK] File exists: ${file}`);
  } else {
    console.error(`[FAIL] Missing file: ${file}`);
    missing++;
  }
}

if (missing === 0) {
  console.log('\nSUCCESS: All 12 Docker Compose services and container definitions verified!');
  process.exit(0);
} else {
  console.error(`\nFAILED: Found ${missing} issues in Docker stack configuration.`);
  process.exit(1);
}
