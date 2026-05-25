import { execSync } from 'child_process';

export function startService() {
  execSync('sudo systemctl start rune', { stdio: 'inherit' });
}

export function restartService() {
  execSync('sudo systemctl restart rune', { stdio: 'inherit' });
}

export function stopService() {
  execSync('sudo systemctl stop rune', { stdio: 'inherit' });
}
